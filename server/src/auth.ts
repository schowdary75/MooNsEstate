import { createHash, randomBytes } from "node:crypto"
import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"
import prisma from "../db/prisma.js"
import { env } from "./env.js"
import { hasSystemPermission, isSystemRole, membershipForUser } from "./tenancy.js"

export type AuthRequest = Request & {
  auth?: {
    userId: string
    legacyRole?: string
    membershipRole?: string
    organizationId: string
    sessionId?: string
  }
}

export const signToken = (userId: string, role?: string) =>
  jwt.sign({ userId, role }, env.JWT_SECRET, { expiresIn: "1d" })

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex")

const cookies = (req: Request) =>
  Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separator = item.indexOf("=")
        if (separator < 0) return [item, ""]
        return [decodeURIComponent(item.slice(0, separator)), decodeURIComponent(item.slice(separator + 1))]
      }),
  )

const sessionToken = (req: Request) => cookies(req)[env.SESSION_COOKIE_NAME]

const cookieOptions = (expiresAt: Date) => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires: expiresAt,
})

const csrfCookieOptions = (expiresAt: Date) => ({
  httpOnly: false,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires: expiresAt,
})

export async function createSession(
  req: Request,
  res: Response,
  userId: string,
  organizationId: string,
  remember = true,
) {
  const token = randomBytes(48).toString("base64url")
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + (remember ? env.SESSION_DAYS : 1))
  const session = await prisma.session.create({
    data: {
      tokenHash: tokenHash(token),
      userId,
      organizationId,
      userAgent: req.header("user-agent") || null,
      ipAddress: req.ip,
      expiresAt,
    },
  })
  res.cookie(env.SESSION_COOKIE_NAME, token, cookieOptions(expiresAt))
  res.cookie("XSRF-TOKEN", randomBytes(32).toString("base64url"), csrfCookieOptions(expiresAt))
  return session
}

export async function revokeSession(req: AuthRequest, res: Response) {
  if (req.auth?.sessionId) {
    await prisma.session.updateMany({
      where: { id: req.auth.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  res.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })
  res.clearCookie("XSRF-TOKEN", {
    httpOnly: false,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  const cookieJar = cookies(req)
  const hasCookieSession = Boolean(
    cookieJar[env.SESSION_COOKIE_NAME] || cookieJar.moon_buyer_session,
  )
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || !hasCookieSession) {
    next()
    return
  }
  const cookieToken = cookieJar["XSRF-TOKEN"]
  const headerToken = req.header("x-xsrf-token")
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({
      error: "The request could not be verified",
      code: "CSRF_TOKEN_INVALID",
    })
    return
  }
  next()
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const opaqueToken = sessionToken(req)
  if (opaqueToken) {
    try {
      const session = await prisma.session.findUnique({
        where: { tokenHash: tokenHash(opaqueToken) },
      })
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        res.clearCookie(env.SESSION_COOKIE_NAME, { path: "/" })
        res.status(401).json({ error: "The session is invalid or expired" })
        return
      }
      const user = await prisma.user.findUnique({ where: { id: session.userId } })
      if (!user || user.deleted) {
        res.status(401).json({ error: "The session user is unavailable" })
        return
      }
      const membership = await membershipForUser(user.id, session.organizationId)
      req.auth = {
        userId: user.id,
        legacyRole: user.role,
        membershipRole: membership.role,
        organizationId: membership.organizationId,
        sessionId: session.id,
      }
      const shouldRotate = Date.now() - session.lastSeenAt.getTime()
        >= env.SESSION_ROTATE_HOURS * 60 * 60_000
      const rotatedToken = shouldRotate ? randomBytes(48).toString("base64url") : null
      await prisma.session.update({
        where: { id: session.id },
        data: {
          lastSeenAt: new Date(),
          organizationId: membership.organizationId,
          ...(rotatedToken ? { tokenHash: tokenHash(rotatedToken) } : {}),
        },
      })
      if (rotatedToken) {
        res.cookie(env.SESSION_COOKIE_NAME, rotatedToken, cookieOptions(session.expiresAt))
      }
      next()
      return
    } catch {
      res.status(401).json({ error: "The session is invalid or expired" })
      return
    }
  }

  const raw = req.header("authorization")
  const token = raw?.replace(/^Bearer\s*/i, "")
  if (!token) {
    res.status(401).json({ error: "Authentication required" })
    return
  }
  try {
    const legacy = jwt.verify(token, env.JWT_SECRET) as { userId: string; role?: string }
    const membership = await membershipForUser(legacy.userId)
    req.auth = {
      userId: legacy.userId,
      legacyRole: legacy.role,
      membershipRole: membership.role,
      organizationId: membership.organizationId,
    }
    next()
  } catch {
    res.status(401).json({ error: "The session is invalid or expired" })
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!["platform_owner", "organization_owner", "organization_admin"].includes(req.auth?.membershipRole || "")) {
    res.status(403).json({ error: "Super administrator access is required" })
    return
  }
  next()
}

export const requirePermission = (permission: string) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (isSystemRole(req.auth?.membershipRole)) {
        if (hasSystemPermission(req.auth?.membershipRole, permission)) {
          next()
          return
        }
        res.status(403).json({
          error: "Your workspace role does not allow this action",
          code: "PERMISSION_DENIED",
          permission,
        })
        return
      }
      const membership = await prisma.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: req.auth!.organizationId,
            userId: req.auth!.userId,
          },
        },
        include: {
          roleRecord: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      })
      const allowed = membership?.status === "active"
        && membership.roleRecord?.permissions.some((item) => item.permission.key === permission)
      if (!allowed) {
        res.status(403).json({
          error: "Your workspace role does not allow this action",
          code: "PERMISSION_DENIED",
          permission,
        })
        return
      }
      next()
    } catch (error) {
      next(error)
    }
  }

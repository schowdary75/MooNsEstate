import { createHash, randomBytes } from "node:crypto"
import { Router, type NextFunction, type Request, type Response } from "express"
import jwt from "jsonwebtoken"
import { z } from "zod"
import prisma from "../../db/prisma.js"
import { env } from "../env.js"
import { normalizeEmail, sendEmail } from "../providers.js"

type BuyerRequest = Request & {
  buyer?: { buyerProfileId: string; organizationId: string }
}

const BUYER_COOKIE = "moon_buyer_session"
const hash = (value: string) => createHash("sha256").update(value).digest("hex")

const cookieValue = (req: Request, name: string) => {
  const item = String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  return item ? decodeURIComponent(item.slice(name.length + 1)) : ""
}

const workspace = async (req: Request) => {
  const requestedSlug = String(req.query.workspace || req.body?.workspace || "").trim()
  if (!requestedSlug) {
    const hostname = req.hostname.toLowerCase()
    const domain = await prisma.organizationDomain.findUnique({ where: { hostname } })
    if (domain?.verified) {
      return prisma.organization.findFirst({
        where: { id: domain.organizationId, deleted: false, portalEnabled: true },
      })
    }
    if (hostname.endsWith(".moonsestate.in")) {
      const subdomain = hostname.slice(0, -".moonsestate.in".length)
      if (subdomain && !subdomain.includes(".")) {
        const organization = await prisma.organization.findFirst({
          where: { slug: subdomain, deleted: false, portalEnabled: true },
        })
        if (organization) return organization
      }
    }
  }
  const slug = requestedSlug || "moon-estates"
  return prisma.organization.findFirst({ where: { slug, deleted: false, portalEnabled: true } })
}

const requireBuyer = async (req: BuyerRequest, res: Response, next: NextFunction) => {
  const token = cookieValue(req, BUYER_COOKIE)
  if (!token) {
    res.status(401).json({ error: "Buyer sign-in is required" })
    return
  }
  try {
    req.buyer = jwt.verify(token, env.JWT_SECRET) as BuyerRequest["buyer"]
    next()
  } catch {
    res.status(401).json({ error: "Buyer session is invalid or expired" })
  }
}

export const portalRouter = Router()

portalRouter.get("/public/properties", async (req, res, next) => {
  try {
    const organization = await workspace(req)
    if (!organization) {
      res.status(404).json({ error: "Workspace portal not found" })
      return
    }
    const search = String(req.query.search || "").trim()
    const propertyType = String(req.query.propertyType || "").trim()
    const builder = String(req.query.builder || "").trim()
    const location = String(req.query.location || "").trim()
    const reraOnly = req.query.rera === "true"
    const availableOnly = req.query.available !== "false"
    const bedrooms = Number(req.query.bedrooms) || undefined
    const budgetMin = Number(req.query.budgetMin) || 0
    const budgetMax = Number(req.query.budgetMax) || Number.MAX_SAFE_INTEGER
    const properties = await prisma.property.findMany({
      where: {
        organizationId: organization.id,
        deleted: false,
        published: true,
        ...(propertyType ? { propertyType } : {}),
        ...(builder ? { builder } : {}),
        ...(location ? { location: { contains: location } } : {}),
        ...(reraOnly ? { reraId: { not: null } } : {}),
        ...(availableOnly ? { status: "Available" } : {}),
        ...(bedrooms ? { bedrooms } : {}),
        ...(search ? {
          OR: [
            { title: { contains: search } },
            { location: { contains: search } },
            { builder: { contains: search } },
            { propertyAddress: { contains: search } },
          ],
        } : {}),
      },
      orderBy: [{ priceUpdatedAt: "desc" }, { updatedDate: "desc" }],
      take: 500,
    })
    const data = properties
      .filter((property) => {
        const listingPrice = Number(String(property.listingPrice || "").replace(/[^0-9.-]/g, ""))
        return listingPrice >= budgetMin && listingPrice <= budgetMax
      })
      .slice(0, 100)
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
    res.json({
      data,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logoUrl,
        primaryColor: organization.primaryColor,
      },
      attribution: "© OpenStreetMap contributors",
    })
  } catch (error) { next(error) }
})

portalRouter.get("/public/properties/:slug", async (req, res, next) => {
  try {
    const organization = await workspace(req)
    if (!organization) {
      res.status(404).json({ error: "Workspace portal not found" })
      return
    }
    const property = await prisma.property.findFirst({
      where: {
        organizationId: organization.id,
        slug: req.params.slug,
        deleted: false,
        published: true,
      },
    })
    if (!property) {
      res.status(404).json({ error: "Property not found" })
      return
    }
    const [media, floorPlans] = await Promise.all([
      prisma.propertyMedia.findMany({ where: { propertyId: property.id }, orderBy: { sortOrder: "asc" } }),
      prisma.floorPlan.findMany({ where: { propertyId: property.id } }),
    ])
    res.json({ data: { ...property, media, floorPlans }, attribution: "© OpenStreetMap contributors" })
  } catch (error) { next(error) }
})

portalRouter.post("/public/auth/passwordless/start", async (req, res, next) => {
  try {
    const organization = await workspace(req)
    if (!organization) {
      res.status(404).json({ error: "Workspace portal not found" })
      return
    }
    const email = normalizeEmail(z.string().email().parse(req.body?.email))
    const fullName = z.string().trim().max(180).optional().parse(req.body?.fullName)
    const buyer = await prisma.buyerProfile.upsert({
      where: { organizationId_email: { organizationId: organization.id, email } },
      update: { ...(fullName ? { fullName } : {}) },
      create: { organizationId: organization.id, email, fullName },
    })
    await prisma.passwordlessToken.deleteMany({
      where: { organizationId: organization.id, email, consumedAt: null },
    })
    const token = randomBytes(32).toString("base64url")
    const expiresAt = new Date(Date.now() + 15 * 60_000)
    await prisma.passwordlessToken.create({
      data: {
        organizationId: organization.id,
        buyerProfileId: buyer.id,
        email,
        tokenHash: hash(token),
        expiresAt,
      },
    })
    const link = `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/portal/verify?token=${encodeURIComponent(token)}&workspace=${organization.slug}`
    try {
      await sendEmail({
        organizationId: organization.id,
        to: email,
        subject: `Sign in to ${organization.name}`,
        text: `Use this secure link within 15 minutes: ${link}`,
        html: `<p>Use this secure link within 15 minutes:</p><p><a href="${link}">Open your property portal</a></p>`,
      })
      res.status(202).json({ data: { status: "sent", expiresAt } })
    } catch (error) {
      if (env.NODE_ENV !== "production" && env.ALLOW_DEVELOPMENT_PROVIDER_PREVIEWS) {
        res.status(202).json({
          data: {
            status: "development_preview",
            expiresAt,
            previewLink: link,
            warning: error instanceof Error ? error.message : "Email provider unavailable",
          },
        })
        return
      }
      const message = error instanceof Error ? error.message : "Magic link email could not be delivered"
      res.status(message.includes("not configured") ? 503 : 502).json({
        error: message.includes("not configured")
          ? "Buyer email sign-in is not configured for this workspace"
          : "The magic link could not be delivered. Please try again.",
      })
      return
    }
  } catch (error) { next(error) }
})

portalRouter.post("/public/auth/passwordless/verify", async (req, res, next) => {
  try {
    const organization = await workspace(req)
    if (!organization) {
      res.status(404).json({ error: "Workspace portal not found" })
      return
    }
    const token = z.string().min(20).parse(req.body?.token)
    const record = await prisma.passwordlessToken.findUnique({ where: { tokenHash: hash(token) } })
    if (
      !record
      || record.organizationId !== organization.id
      || !record.buyerProfileId
      || record.consumedAt
      || record.expiresAt <= new Date()
    ) {
      res.status(400).json({ error: "This sign-in link is invalid or expired" })
      return
    }
    await prisma.passwordlessToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    })
    const session = jwt.sign(
      { buyerProfileId: record.buyerProfileId, organizationId: organization.id },
      env.JWT_SECRET,
      { expiresIn: "30d" },
    )
    res.cookie(BUYER_COOKIE, session, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1_000,
    })
    res.cookie("XSRF-TOKEN", randomBytes(32).toString("base64url"), {
      httpOnly: false,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1_000,
    })
    const buyer = await prisma.buyerProfile.findUnique({ where: { id: record.buyerProfileId } })
    res.json({ data: buyer })
  } catch (error) { next(error) }
})

portalRouter.get("/portal/me", requireBuyer, async (req: BuyerRequest, res, next) => {
  try {
    const data = await prisma.buyerProfile.findFirst({
      where: { id: req.buyer!.buyerProfileId, organizationId: req.buyer!.organizationId },
    })
    res.json({ data })
  } catch (error) { next(error) }
})

portalRouter.get("/portal/shortlists", requireBuyer, async (req: BuyerRequest, res, next) => {
  try {
    const shortlists = await prisma.shortlist.findMany({
      where: {
        organizationId: req.buyer!.organizationId,
        buyerProfileId: req.buyer!.buyerProfileId,
      },
      orderBy: { updatedDate: "desc" },
    })
    const data = await Promise.all(shortlists.map(async (shortlist) => {
      const items = await prisma.shortlistItem.findMany({ where: { shortlistId: shortlist.id } })
      const properties = await prisma.property.findMany({
        where: {
          organizationId: req.buyer!.organizationId,
          id: { in: items.map((item) => item.propertyId) },
          published: true,
          deleted: false,
        },
      })
      return {
        ...shortlist,
        items: items.map((item) => ({
          ...item,
          property: properties.find((property) => property.id === item.propertyId) || null,
        })),
      }
    }))
    res.json({ data })
  } catch (error) { next(error) }
})

portalRouter.get("/portal/site-visits", requireBuyer, async (req: BuyerRequest, res, next) => {
  try {
    const visits = await prisma.siteVisit.findMany({
      where: {
        organizationId: req.buyer!.organizationId,
        buyerProfileId: req.buyer!.buyerProfileId,
      },
      orderBy: { scheduledAt: "desc" },
      take: 100,
    })
    const properties = await prisma.property.findMany({
      where: {
        organizationId: req.buyer!.organizationId,
        id: { in: visits.map((visit) => visit.propertyId) },
        deleted: false,
      },
      select: { id: true, title: true, propertyAddress: true, builder: true },
    })
    res.json({
      data: visits.map((visit) => ({
        ...visit,
        property: properties.find((property) => property.id === visit.propertyId) || null,
      })),
    })
  } catch (error) { next(error) }
})

portalRouter.get("/portal/communications", requireBuyer, async (req: BuyerRequest, res, next) => {
  try {
    const buyer = await prisma.buyerProfile.findFirst({
      where: {
        id: req.buyer!.buyerProfileId,
        organizationId: req.buyer!.organizationId,
      },
    })
    if (!buyer) {
      res.status(404).json({ error: "Buyer profile not found" })
      return
    }
    const candidates = await prisma.lead.findMany({
      where: {
        organizationId: req.buyer!.organizationId,
        deleted: false,
        OR: [
          { leadEmail: buyer.email },
          ...(buyer.phoneE164 ? [{ phoneE164: buyer.phoneE164 }] : []),
        ],
      },
      select: { id: true },
      take: 2,
    })
    if (candidates.length !== 1) {
      res.json({
        data: [],
        meta: {
          linked: false,
          reason: candidates.length > 1 ? "ambiguous_lead_match" : "no_lead_match",
        },
      })
      return
    }
    const conversations = await prisma.conversation.findMany({
      where: {
        organizationId: req.buyer!.organizationId,
        leadId: candidates[0]!.id,
      },
      select: { id: true, channel: true, subject: true },
    })
    const messages = await prisma.message.findMany({
      where: {
        organizationId: req.buyer!.organizationId,
        conversationId: { in: conversations.map((conversation) => conversation.id) },
        direction: { in: ["inbound", "outbound"] },
      },
      orderBy: { createdDate: "desc" },
      take: 100,
    })
    res.json({
      data: messages.map((message) => ({
        ...message,
        conversation: conversations.find((conversation) => conversation.id === message.conversationId),
      })),
      meta: { linked: true },
    })
  } catch (error) { next(error) }
})

portalRouter.post("/portal/shortlists/items", requireBuyer, async (req: BuyerRequest, res, next) => {
  try {
    const propertyId = z.string().uuid().parse(req.body?.propertyId)
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        organizationId: req.buyer!.organizationId,
        published: true,
        deleted: false,
      },
    })
    if (!property) {
      res.status(404).json({ error: "Property not found" })
      return
    }
    let shortlist = await prisma.shortlist.findFirst({
      where: {
        organizationId: req.buyer!.organizationId,
        buyerProfileId: req.buyer!.buyerProfileId,
      },
    })
    if (!shortlist) {
      shortlist = await prisma.shortlist.create({
        data: {
          organizationId: req.buyer!.organizationId,
          buyerProfileId: req.buyer!.buyerProfileId,
        },
      })
    }
    const data = await prisma.shortlistItem.upsert({
      where: { shortlistId_propertyId: { shortlistId: shortlist.id, propertyId } },
      update: {},
      create: {
        organizationId: req.buyer!.organizationId,
        shortlistId: shortlist.id,
        propertyId,
      },
    })
    await prisma.activityEvent.create({
      data: {
        organizationId: req.buyer!.organizationId,
        propertyId,
        type: "portal.shortlisted",
        title: "Property shortlisted",
        metadata: { buyerProfileId: req.buyer!.buyerProfileId },
      },
    })
    res.status(201).json({ data })
  } catch (error) { next(error) }
})

portalRouter.post("/portal/site-visits", requireBuyer, async (req: BuyerRequest, res, next) => {
  try {
    const input = z.object({
      propertyId: z.string().uuid(),
      scheduledAt: z.coerce.date().refine((value) => value > new Date(), "Site visit must be in the future"),
      notes: z.string().max(2_000).optional(),
    }).parse(req.body)
    const property = await prisma.property.findFirst({
      where: {
        id: input.propertyId,
        organizationId: req.buyer!.organizationId,
        published: true,
        deleted: false,
      },
    })
    if (!property) {
      res.status(404).json({ error: "Property not found" })
      return
    }
    const data = await prisma.siteVisit.create({
      data: {
        organizationId: req.buyer!.organizationId,
        buyerProfileId: req.buyer!.buyerProfileId,
        propertyId: property.id,
        scheduledAt: input.scheduledAt,
        notes: input.notes,
      },
    })
    res.status(201).json({ data })
  } catch (error) { next(error) }
})

portalRouter.post("/portal/inquiries", requireBuyer, async (req: BuyerRequest, res, next) => {
  try {
    const input = z.object({
      propertyId: z.string().uuid(),
      phone: z.string().trim().min(7).max(24).optional(),
      message: z.string().trim().min(1).max(2_000),
      consentStatus: z.enum(["granted", "unknown"]).default("unknown"),
    }).parse(req.body)
    const [buyer, property] = await Promise.all([
      prisma.buyerProfile.findFirst({
        where: { id: req.buyer!.buyerProfileId, organizationId: req.buyer!.organizationId },
      }),
      prisma.property.findFirst({
        where: {
          id: input.propertyId,
          organizationId: req.buyer!.organizationId,
          published: true,
          deleted: false,
        },
      }),
    ])
    if (!buyer || !property) {
      res.status(404).json({ error: "Buyer or property not found" })
      return
    }
    const phone = input.phone || buyer.phoneE164 || ""
    const existing = await prisma.lead.findFirst({
      where: {
        organizationId: req.buyer!.organizationId,
        deleted: false,
        OR: [
          ...(buyer.email ? [{ leadEmail: buyer.email }] : []),
          ...(phone ? [{ phoneE164: phone }] : []),
        ],
      },
    })
    const lead = existing
      ? await prisma.lead.update({
          where: { id: existing.id },
          data: {
            notes: [existing.notes, `${property.title || property.propertyAddress}: ${input.message}`]
              .filter(Boolean)
              .join("\n"),
            consentStatus: input.consentStatus,
          },
        })
      : await prisma.lead.create({
          data: {
            organizationId: req.buyer!.organizationId,
            leadName: buyer.fullName || buyer.email || "Buyer portal inquiry",
            leadEmail: buyer.email,
            leadPhoneNumber: phone || null,
            phoneE164: phone || null,
            leadSource: "Buyer Portal",
            leadStatus: "New",
            priority: "High",
            consentStatus: input.consentStatus,
            notes: `${property.title || property.propertyAddress}: ${input.message}`,
            firstResponseDueAt: new Date(Date.now() + 5 * 60_000),
          },
        })
    await prisma.activityEvent.create({
      data: {
        organizationId: req.buyer!.organizationId,
        leadId: lead.id,
        propertyId: property.id,
        type: "portal.inquiry",
        title: "Buyer requested a callback",
        description: input.message,
        metadata: { buyerProfileId: buyer.id },
      },
    })
    res.status(201).json({ data: { leadId: lead.id, status: "received" } })
  } catch (error) { next(error) }
})

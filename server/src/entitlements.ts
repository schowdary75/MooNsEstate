import type { NextFunction, Response } from "express"
import prisma from "../db/prisma.js"
import type { AuthRequest } from "./auth.js"

const writableStatuses = new Set(["active", "trialing"])

export async function requireWritableSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next()
    return
  }
  if (req.path.endsWith("/switch") || req.path.startsWith("/sessions")) {
    next()
    return
  }
  const subscription = await prisma.subscription.findFirst({
    where: { organizationId: req.auth!.organizationId },
    orderBy: { createdDate: "desc" },
  })
  if (!subscription) {
    res.status(402).json({
      error: "A workspace subscription is required before records can be changed",
      code: "SUBSCRIPTION_REQUIRED",
    })
    return
  }
  const graceActive = subscription.status === "past_due"
    && Boolean(subscription.graceEndsAt && subscription.graceEndsAt > new Date())
  if (!writableStatuses.has(subscription.status) && !graceActive) {
    res.status(402).json({
      error: "This workspace is read-only until billing is resolved",
      code: "SUBSCRIPTION_READ_ONLY",
      billingAllowed: true,
      exportAllowed: true,
    })
    return
  }
  next()
}

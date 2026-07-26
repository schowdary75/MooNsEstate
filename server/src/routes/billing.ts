import { Router } from "express"
import Stripe from "stripe"
import { z } from "zod"
import prisma from "../../db/prisma.js"
import { requireAuth, requirePermission, type AuthRequest } from "../auth.js"
import { env } from "../env.js"
import { integrationConfig } from "../integration-config.js"
import { canManageOrganization } from "../tenancy.js"

type StripeConfig = { secretKey?: string; webhookSecret?: string }
type RazorpayConfig = { keyId?: string; keySecret?: string; webhookSecret?: string }

const stripeFor = async (organizationId: string) => {
  const stored = await integrationConfig<StripeConfig>(organizationId, "stripe")
  const secretKey = stored?.secretKey || env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error("Stripe is not configured for this workspace")
  return new Stripe(secretKey)
}

const checkoutInput = z.object({
  planId: z.string().uuid(),
  provider: z.enum(["razorpay", "stripe"]).default("razorpay"),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
  quantity: z.number().int().min(1).max(1_000).default(1),
})

export const billingRouter = Router()
billingRouter.use(requireAuth)

billingRouter.get("/billing/plans", async (_req, res, next) => {
  try {
    const data = await prisma.plan.findMany({ where: { active: true }, orderBy: { monthlyPrice: "asc" } })
    res.json({ data })
  } catch (error) { next(error) }
})

billingRouter.patch("/billing/plans/:id", async (req: AuthRequest, res, next) => {
  try {
    if (req.auth?.membershipRole !== "platform_owner" && req.auth?.legacyRole !== "superAdmin") {
      res.status(403).json({ error: "Platform owner access is required" })
      return
    }
    const input = z.object({
      monthlyPrice: z.coerce.number().min(0).optional(),
      annualPrice: z.coerce.number().min(0).optional(),
      includedSeats: z.coerce.number().int().min(1).optional(),
      includedLeads: z.coerce.number().int().min(0).optional(),
      includedStorageMb: z.coerce.number().int().min(0).optional(),
      includedMessages: z.coerce.number().int().min(0).optional(),
      includedTranscriptionMinutes: z.coerce.number().int().min(0).optional(),
      razorpayMonthlyPlanId: z.string().optional().nullable(),
      razorpayAnnualPlanId: z.string().optional().nullable(),
      stripeMonthlyPriceId: z.string().optional().nullable(),
      stripeAnnualPriceId: z.string().optional().nullable(),
      active: z.boolean().optional(),
    }).parse(req.body)
    const data = await prisma.plan.update({ where: { id: String(req.params.id) }, data: input })
    res.json({ data })
  } catch (error) { next(error) }
})

billingRouter.get("/billing/subscription", async (req: AuthRequest, res, next) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { createdDate: "desc" },
    })
    const plan = subscription
      ? await prisma.plan.findUnique({ where: { id: subscription.planId } })
      : null
    const usage = await prisma.usageLedger.groupBy({
      by: ["usageType"],
      where: {
        organizationId: req.auth!.organizationId,
        ...(subscription?.currentPeriodStart ? { occurredAt: { gte: subscription.currentPeriodStart } } : {}),
      },
      _sum: { quantity: true },
    })
    res.json({
      data: {
        subscription: subscription ? { ...subscription, plan } : null,
        plan,
        usage: usage.map((item) => ({
          usageType: item.usageType,
          quantity: item._sum.quantity || 0,
        })),
      },
    })
  } catch (error) { next(error) }
})

billingRouter.post("/billing/checkout", requirePermission("billing.manage"), async (req: AuthRequest, res, next) => {
  try {
    if (!canManageOrganization(req.auth?.membershipRole)) {
      res.status(403).json({ error: "Organization owner access is required" })
      return
    }
    const input = checkoutInput.parse(req.body)
    const [organization, plan] = await Promise.all([
      prisma.organization.findUnique({ where: { id: req.auth!.organizationId } }),
      prisma.plan.findUnique({ where: { id: input.planId } }),
    ])
    if (!organization || !plan?.active) {
      res.status(404).json({ error: "Organization or plan not found" })
      return
    }

    if (input.provider === "razorpay") {
      const stored = await integrationConfig<RazorpayConfig>(req.auth!.organizationId, "razorpay")
      const keyId = stored?.keyId || env.RAZORPAY_KEY_ID
      const keySecret = stored?.keySecret || env.RAZORPAY_KEY_SECRET
      if (!keyId || !keySecret) {
        res.status(503).json({ error: "Razorpay billing is not configured" })
        return
      }
      const providerPlanId = input.interval === "annual"
        ? plan.razorpayAnnualPlanId
        : plan.razorpayMonthlyPlanId
      if (!providerPlanId) {
        res.status(409).json({ error: `Razorpay ${input.interval} plan mapping is not configured` })
        return
      }
      const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: providerPlanId,
          total_count: input.interval === "annual" ? 30 : 360,
          quantity: input.quantity,
          customer_notify: 1,
          notes: {
            organizationId: organization.id,
            planId: plan.id,
            interval: input.interval,
          },
        }),
      })
      const payload = await response.json() as { id?: string; error?: { description?: string } }
      if (!response.ok || !payload.id) {
        res.status(502).json({ error: payload.error?.description || "Razorpay checkout could not be created" })
        return
      }
      res.status(201).json({
        data: {
          provider: "razorpay",
          keyId,
          subscriptionId: payload.id,
          organization: { name: organization.name },
          plan: { name: plan.name },
        },
      })
      return
    }

    const priceId = input.interval === "annual" ? plan.stripeAnnualPriceId : plan.stripeMonthlyPriceId
    if (!priceId) {
      res.status(409).json({ error: `Stripe ${input.interval} price mapping is not configured` })
      return
    }
    const stripe = await stripeFor(req.auth!.organizationId)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/settings?billing=success`,
      cancel_url: `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/settings?billing=cancelled`,
      line_items: [{ price: priceId, quantity: input.quantity }],
      client_reference_id: organization.id,
      subscription_data: {
        metadata: {
          organizationId: organization.id,
          planId: plan.id,
          interval: input.interval,
        },
      },
      metadata: {
        organizationId: organization.id,
        planId: plan.id,
      },
    })
    res.status(201).json({ data: { provider: "stripe", checkoutUrl: session.url } })
  } catch (error) { next(error) }
})

billingRouter.post("/billing/portal", requirePermission("billing.manage"), async (req: AuthRequest, res, next) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { createdDate: "desc" },
    })
    if (!subscription) {
      res.status(404).json({ error: "Subscription not found" })
      return
    }
    if (subscription.provider !== "stripe") {
      res.json({
        data: {
          provider: subscription.provider,
          managedInApp: true,
          message: "Razorpay subscription changes are managed from MooNsEstate billing settings.",
        },
      })
      return
    }
    if (!subscription.providerCustomerId) {
      res.status(409).json({ error: "Stripe customer mapping is unavailable" })
      return
    }
    const stripe = await stripeFor(req.auth!.organizationId)
    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.providerCustomerId,
      return_url: `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/settings`,
    })
    res.json({ data: { provider: "stripe", portalUrl: portal.url } })
  } catch (error) { next(error) }
})

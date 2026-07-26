import { Router } from "express"
import { z } from "zod"
import prisma from "../../db/prisma.js"
import { requireAuth, requirePermission, type AuthRequest } from "../auth.js"
import { projectSlugForProperty, syncPropertyInventory } from "../crud.js"
import { requireWritableSubscription } from "../entitlements.js"
import { geocodeAddress, normalizeEmail, normalizePhone } from "../providers.js"
import { canManageOrganization, canManageSales, ensureRoleCatalog } from "../tenancy.js"

const leadInput = z.object({
  leadName: z.string().trim().min(1).max(180),
  leadEmail: z.string().trim().email().optional().or(z.literal("")),
  leadPhoneNumber: z.string().trim().min(7).max(24),
  leadAddress: z.string().trim().max(2_000).optional(),
  leadStatus: z.string().trim().max(80).default("New"),
  leadSource: z.string().trim().max(120).default("Manual"),
  priority: z.enum(["Urgent", "High", "Medium", "Low"]).default("Medium"),
  notes: z.string().max(10_000).optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  preferredLanguage: z.string().max(20).default("en-IN"),
  consentStatus: z.enum(["unknown", "granted", "revoked"]).default("unknown"),
})

const leadPatch = leadInput.partial().extend({
  nextFollowUpDate: z.coerce.date().optional().nullable(),
})

const followUpInput = z.object({
  leadId: z.string().uuid(),
  ownerId: z.string().uuid().optional().nullable(),
  followUpType: z.enum(["call", "site_visit", "whatsapp", "email", "meeting", "quote", "other"]),
  followUpDate: z.coerce.date(),
  priority: z.enum(["urgent", "high", "medium", "low"]).default("medium"),
  status: z.enum(["pending", "completed", "cancelled", "overdue"]).default("pending"),
  notes: z.string().max(10_000).optional(),
  outcome: z.string().max(10_000).optional(),
})

const followUpPatch = followUpInput.partial().extend({
  leadStatus: z.string().trim().max(80).optional(),
})

const automationStepInput = z.object({
  offsetMinutes: z.number().int().min(0).max(525_600),
  channel: z.enum(["whatsapp", "email", "call", "task", "site_visit"]),
  priority: z.enum(["urgent", "high", "medium", "low"]).default("medium"),
  notes: z.string().trim().min(1).max(2_000),
  templateName: z.string().trim().max(200).optional(),
})

const automationSequenceInput = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2_000).optional(),
  triggerType: z.enum(["manual", "meta_lead", "no_response", "shortlist", "site_visit", "post_visit"]).default("manual"),
  steps: z.array(automationStepInput).min(1).max(20),
  pauseOnConversion: z.boolean().default(true),
  status: z.enum(["active", "paused", "archived"]).default("active"),
})

const defaultAutomationSequences = [
  {
    name: "New Meta lead",
    description: "Respond quickly, retry by phone, then send a final property follow-up.",
    triggerType: "meta_lead",
    steps: [
      { offsetMinutes: 0, channel: "whatsapp", priority: "urgent", notes: "Send the approved new-lead acknowledgement template." },
      { offsetMinutes: 15, channel: "call", priority: "high", notes: "Call the lead and confirm budget, locality, BHK, and timeline." },
      { offsetMinutes: 1_440, channel: "email", priority: "medium", notes: "Share a relevant shortlist only if email consent is available." },
    ],
  },
  {
    name: "No response",
    description: "A respectful three-touch retry sequence.",
    triggerType: "no_response",
    steps: [
      { offsetMinutes: 0, channel: "call", priority: "high", notes: "Retry the lead during configured business hours." },
      { offsetMinutes: 1_440, channel: "whatsapp", priority: "medium", notes: "Send an approved no-response template." },
      { offsetMinutes: 4_320, channel: "task", priority: "low", notes: "Review whether the lead should be nurtured or closed." },
    ],
  },
  {
    name: "Property shortlist",
    description: "Confirm preferences and move the buyer toward a visit.",
    triggerType: "shortlist",
    steps: [
      { offsetMinutes: 0, channel: "email", priority: "medium", notes: "Send the verified property shortlist." },
      { offsetMinutes: 180, channel: "call", priority: "medium", notes: "Discuss shortlist feedback and preferred visit slots." },
    ],
  },
  {
    name: "Site-visit reminder",
    description: "Prepare and remind the buyer before the scheduled visit.",
    triggerType: "site_visit",
    steps: [
      { offsetMinutes: 0, channel: "task", priority: "high", notes: "Confirm agent, project access, and meeting point." },
      { offsetMinutes: 60, channel: "whatsapp", priority: "high", notes: "Send the approved site-visit reminder template." },
    ],
  },
  {
    name: "Post-visit feedback",
    description: "Capture buyer feedback and agree the next action.",
    triggerType: "post_visit",
    steps: [
      { offsetMinutes: 120, channel: "call", priority: "high", notes: "Capture property feedback, objections, and decision timeline." },
      { offsetMinutes: 1_440, channel: "email", priority: "medium", notes: "Send requested comparisons or documents." },
    ],
  },
] as const

async function ensureDefaultAutomationSequences(organizationId: string) {
  for (const sequence of defaultAutomationSequences) {
    await prisma.automationSequence.upsert({
      where: { organizationId_name: { organizationId, name: sequence.name } },
      update: {},
      create: {
        organizationId,
        ...sequence,
        steps: JSON.parse(JSON.stringify(sequence.steps)),
      },
    })
  }
}

const siteVisitInput = z.object({
  leadId: z.string().uuid().optional().nullable(),
  buyerProfileId: z.string().uuid().optional().nullable(),
  propertyId: z.string().uuid(),
  assignedTo: z.string().uuid().optional().nullable(),
  scheduledAt: z.coerce.date(),
  notes: z.string().max(10_000).optional(),
})

const propertyUnitInput = z.object({
  floorNumber: z.number().int().min(1).max(250),
  unitNumber: z.string().trim().min(1).max(40),
  bedrooms: z.number().int().min(0).max(20).nullable().optional(),
  bathrooms: z.number().int().min(0).max(30).nullable().optional(),
  carpetArea: z.number().int().min(1).max(1_000_000).nullable().optional(),
  facing: z.string().trim().max(80).nullable().optional(),
  listingPrice: z.number().min(0).max(10_000_000_000_000).nullable().optional(),
  status: z.enum(["Available", "Under Offer", "Reserved", "Sold"]).default("Available"),
})

const propertyUnitPatch = propertyUnitInput.partial()

const pageInput = (req: AuthRequest) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

const audit = (
  req: AuthRequest,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) => prisma.auditEvent.create({
  data: {
    organizationId: req.auth?.organizationId,
    actorUserId: req.auth?.userId,
    action,
    entityType,
    entityId,
    ipAddress: req.ip,
    metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
  },
})

async function nextAgent(organizationId: string) {
  const agents = await prisma.membership.findMany({
    where: {
      organizationId,
      status: "active",
      role: { in: ["agent", "sales_manager", "organization_owner", "organization_admin"] },
    },
    orderBy: { createdDate: "asc" },
  })
  if (!agents.length) return null
  const counts = await Promise.all(
    agents.map(async (agent) => ({
      userId: agent.userId,
      count: await prisma.lead.count({
        where: {
          organizationId,
          assignedTo: agent.userId,
          deleted: false,
          leadStatus: { notIn: ["Converted", "Closed Lost"] },
        },
      }),
    })),
  )
  counts.sort((left, right) => left.count - right.count || left.userId.localeCompare(right.userId))
  return counts[0]?.userId || null
}

async function propertyInventoryContext(
  propertyId: string,
  organizationId: string,
  ensure = false,
) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId, deleted: false },
  })
  if (!property) return null

  const projectKey = {
    organizationId_slug: {
      organizationId,
      slug: projectSlugForProperty(property as unknown as Record<string, unknown>),
    },
  }
  let project = await prisma.realEstateProject.findUnique({ where: projectKey })
  let tower = project && property.towerName
    ? await prisma.propertyTower.findUnique({
        where: { projectId_name: { projectId: project.id, name: property.towerName } },
      })
    : null

  if (ensure && (!project || !tower)) {
    await syncPropertyInventory(property as unknown as Record<string, unknown>)
    project = await prisma.realEstateProject.findUnique({ where: projectKey })
    tower = project && property.towerName
      ? await prisma.propertyTower.findUnique({
          where: { projectId_name: { projectId: project.id, name: property.towerName } },
        })
      : null
  }

  return { property, project, tower }
}

async function inventoryUnits(towerId: string, property: { floorNumber: number | null; unitNumber: string | null; id: string }) {
  const floors = await prisma.propertyFloor.findMany({
    where: { towerId },
    orderBy: { floorNumber: "asc" },
  })
  const units = floors.length
    ? await prisma.propertyUnit.findMany({
        where: { floorId: { in: floors.map((floor) => floor.id) } },
        orderBy: [{ floorId: "asc" }, { unitNumber: "asc" }],
      })
    : []
  const floorNumbers = new Map(floors.map((floor) => [floor.id, floor.floorNumber]))

  return units.map((unit) => ({
    ...unit,
    floorNumber: floorNumbers.get(unit.floorId),
    isPrimary: unit.propertyId === property.id
      && unit.unitNumber === property.unitNumber
      && floorNumbers.get(unit.floorId) === property.floorNumber,
  }))
}

export const coreRouter = Router()
coreRouter.use(requireAuth)
coreRouter.use(requireWritableSubscription)

coreRouter.get("/session", async (req: AuthRequest, res, next) => {
  try {
    const [user, organization, membership, subscription] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.auth!.userId },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          role: true,
        },
      }),
      prisma.organization.findUnique({ where: { id: req.auth!.organizationId } }),
      prisma.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: req.auth!.organizationId,
            userId: req.auth!.userId,
          },
        },
      }),
      prisma.subscription.findFirst({
        where: { organizationId: req.auth!.organizationId },
        orderBy: { createdDate: "desc" },
      }),
    ])
    res.json({ data: { user, organization, membership, subscription } })
  } catch (error) { next(error) }
})

coreRouter.get("/sessions", async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.session.findMany({
      where: { userId: req.auth!.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        organizationId: true,
        userAgent: true,
        ipAddress: true,
        lastSeenAt: true,
        expiresAt: true,
        createdDate: true,
      },
      orderBy: { lastSeenAt: "desc" },
    })
    res.json({ data: data.map((session) => ({ ...session, current: session.id === req.auth!.sessionId })) })
  } catch (error) { next(error) }
})

coreRouter.post("/sessions/:id/revoke", async (req: AuthRequest, res, next) => {
  try {
    const id = String(req.params.id)
    const result = await prisma.session.updateMany({
      where: { id, userId: req.auth!.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    if (!result.count) {
      res.status(404).json({ error: "Active session not found" })
      return
    }
    res.status(204).end()
  } catch (error) { next(error) }
})

coreRouter.get("/organizations", async (req: AuthRequest, res, next) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.auth!.userId, status: "active" },
    })
    const organizations = await prisma.organization.findMany({
      where: { id: { in: memberships.map((item) => item.organizationId) }, deleted: false },
      orderBy: { name: "asc" },
    })
    res.json({
      data: organizations.map((organization) => ({
        ...organization,
        membershipRole: memberships.find((item) => item.organizationId === organization.id)?.role,
        active: organization.id === req.auth!.organizationId,
      })),
    })
  } catch (error) { next(error) }
})

coreRouter.post("/organizations", async (req: AuthRequest, res, next) => {
  try {
    if (!canManageOrganization(req.auth?.membershipRole)) {
      res.status(403).json({ error: "Organization owner access is required" })
      return
    }
    const input = z.object({
      name: z.string().trim().min(2).max(120),
      slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      currency: z.string().length(3).default("INR"),
      timezone: z.string().default("Asia/Kolkata"),
    }).parse(req.body)
    const starter = await prisma.plan.findUnique({ where: { code: "starter" } })
    if (!starter) throw new Error("Starter billing plan is not configured")
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60_000)
    const organization = await prisma.$transaction(async (transaction) => {
      const created = await transaction.organization.create({ data: input })
      await transaction.membership.create({
        data: {
          organizationId: created.id,
          userId: req.auth!.userId,
          role: "organization_owner",
        },
      })
      await transaction.subscription.create({
        data: {
          organizationId: created.id,
          planId: starter.id,
          provider: input.currency === "INR" ? "razorpay" : "stripe",
          status: "trialing",
          trialEndsAt,
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndsAt,
        },
      })
      return created
    })
    await ensureRoleCatalog(organization.id)
    await audit(req, "organization.created", "organization", organization.id)
    res.status(201).json({ data: organization })
  } catch (error) { next(error) }
})

coreRouter.get("/organization-domains", async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.organizationDomain.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { createdDate: "asc" },
    })
    res.json({ data })
  } catch (error) { next(error) }
})

coreRouter.post("/organization-domains", async (req: AuthRequest, res, next) => {
  try {
    if (!canManageOrganization(req.auth?.membershipRole)) {
      res.status(403).json({ error: "Organization administrator access is required" })
      return
    }
    const hostname = z.string()
      .trim()
      .toLowerCase()
      .max(253)
      .regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/)
      .parse(req.body?.hostname)
    const data = await prisma.organizationDomain.create({
      data: {
        organizationId: req.auth!.organizationId,
        hostname,
        verified: false,
      },
    })
    await audit(req, "organization_domain.created", "organization_domain", data.id, { hostname })
    res.status(201).json({ data })
  } catch (error) { next(error) }
})

coreRouter.delete("/organization-domains/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!canManageOrganization(req.auth?.membershipRole)) {
      res.status(403).json({ error: "Organization administrator access is required" })
      return
    }
    const domain = await prisma.organizationDomain.findFirst({
      where: { id: String(req.params.id), organizationId: req.auth!.organizationId },
    })
    if (!domain) {
      res.status(404).json({ error: "Organization domain not found" })
      return
    }
    await prisma.organizationDomain.delete({ where: { id: domain.id } })
    await audit(req, "organization_domain.deleted", "organization_domain", domain.id, {
      hostname: domain.hostname,
    })
    res.status(204).end()
  } catch (error) { next(error) }
})

coreRouter.get("/roles", async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.role.findMany({
      where: { organizationId: req.auth!.organizationId },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
      orderBy: [{ system: "desc" }, { label: "asc" }],
    })
    res.json({
      data: data.map((role) => ({
        ...role,
        permissions: role.permissions.map((item) => item.permission.key),
      })),
    })
  } catch (error) { next(error) }
})

coreRouter.get("/memberships", async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.membership.findMany({
      where: { organizationId: req.auth!.organizationId, status: "active" },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
        roleRecord: true,
      },
      orderBy: { createdDate: "asc" },
    })
    res.json({ data })
  } catch (error) { next(error) }
})

coreRouter.patch("/memberships/:id", async (req: AuthRequest, res, next) => {
  try {
    if (!canManageOrganization(req.auth?.membershipRole)) {
      res.status(403).json({ error: "Organization administrator access is required" })
      return
    }
    const input = z.object({
      role: z.enum([
        "platform_owner",
        "organization_owner",
        "organization_admin",
        "sales_manager",
        "marketing_manager",
        "agent",
        "finance",
        "read_only",
      ]),
      status: z.enum(["active", "removed"]).optional(),
    }).parse(req.body)
    const membership = await prisma.membership.findFirst({
      where: { id: String(req.params.id), organizationId: req.auth!.organizationId },
    })
    if (!membership) {
      res.status(404).json({ error: "Membership not found" })
      return
    }
    const role = await prisma.role.findUnique({
      where: {
        organizationId_name: {
          organizationId: req.auth!.organizationId,
          name: input.role,
        },
      },
    })
    if (!role) throw new Error("Workspace role catalog is unavailable")
    const data = await prisma.membership.update({
      where: { id: membership.id },
      data: { role: input.role, roleId: role.id, status: input.status },
    })
    res.json({ data })
  } catch (error) { next(error) }
})

coreRouter.post("/organizations/:organizationId/switch", async (req: AuthRequest, res, next) => {
  try {
    const membership = await prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: String(req.params.organizationId),
          userId: req.auth!.userId,
        },
      },
    })
    if (!membership || membership.status !== "active") {
      res.status(403).json({ error: "You are not a member of this workspace" })
      return
    }
    if (req.auth?.sessionId) {
      await prisma.session.update({
        where: { id: req.auth.sessionId },
        data: { organizationId: membership.organizationId },
      })
    }
    res.json({ data: { organizationId: membership.organizationId } })
  } catch (error) { next(error) }
})

coreRouter.get("/leads", requirePermission("leads.read"), async (req: AuthRequest, res, next) => {
  try {
    const { page, pageSize, skip } = pageInput(req)
    const search = String(req.query.search || "").trim()
    const status = String(req.query.status || "").trim()
    const where = {
      organizationId: req.auth!.organizationId,
      deleted: false,
      ...(status ? { leadStatus: status } : {}),
      ...(search ? {
        OR: [
          { leadName: { contains: search } },
          { leadEmail: { contains: search } },
          { leadPhoneNumber: { contains: search } },
        ],
      } : {}),
    }
    const [data, total] = await Promise.all([
      prisma.lead.findMany({ where, skip, take: pageSize, orderBy: { createdDate: "desc" } }),
      prisma.lead.count({ where }),
    ])
    res.json({ data, meta: { page, pageSize, total, pages: Math.ceil(total / pageSize) } })
  } catch (error) { next(error) }
})

coreRouter.post("/leads", requirePermission("leads.write"), async (req: AuthRequest, res, next) => {
  try {
    const input = leadInput.parse(req.body)
    const organizationId = req.auth!.organizationId
    const assignedTo = input.assignedTo || await nextAgent(organizationId) || req.auth!.userId
    const firstResponseDueAt = new Date(Date.now() + 5 * 60_000)
    const lead = await prisma.lead.create({
      data: {
        ...input,
        leadEmail: input.leadEmail ? normalizeEmail(input.leadEmail) : null,
        phoneE164: normalizePhone(input.leadPhoneNumber),
        assignedTo,
        organizationId,
        createBy: req.auth!.userId,
        firstResponseDueAt,
      },
    })
    await Promise.all([
      prisma.activityEvent.create({
        data: {
          organizationId,
          leadId: lead.id,
          actorUserId: req.auth!.userId,
          type: "lead.created",
          title: "Lead created",
          metadata: { source: lead.leadSource, assignedTo },
        },
      }),
      audit(req, "lead.created", "lead", lead.id),
    ])
    res.status(201).json({ data: lead })
  } catch (error) { next(error) }
})

coreRouter.patch("/leads/:id", requirePermission("leads.write"), async (req: AuthRequest, res, next) => {
  try {
    const input = leadPatch.parse(req.body)
    const existing = await prisma.lead.findFirst({
      where: { id: String(req.params.id), organizationId: req.auth!.organizationId, deleted: false },
    })
    if (!existing) {
      res.status(404).json({ error: "Lead not found" })
      return
    }
    if (input.assignedTo && !canManageSales(req.auth?.membershipRole) && input.assignedTo !== req.auth?.userId) {
      res.status(403).json({ error: "Sales manager access is required to reassign leads" })
      return
    }
    const lead = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        ...input,
        ...(input.leadPhoneNumber ? { phoneE164: normalizePhone(input.leadPhoneNumber) } : {}),
        ...(input.leadEmail !== undefined ? { leadEmail: input.leadEmail ? normalizeEmail(input.leadEmail) : null } : {}),
        ...(input.leadStatus === "Converted" && !existing.convertedAt ? { convertedAt: new Date() } : {}),
      },
    })
    await prisma.activityEvent.create({
      data: {
        organizationId: req.auth!.organizationId,
        leadId: lead.id,
        actorUserId: req.auth!.userId,
        type: "lead.updated",
        title: "Lead updated",
        metadata: input,
      },
    })
    if (
      lead.metaLeadId
      && lead.consentStatus === "granted"
      && input.leadStatus
      && ["Qualified", "Appointment", "Converted"].includes(input.leadStatus)
    ) {
      const eventName = input.leadStatus === "Qualified"
        ? "QualifiedLead"
        : input.leadStatus === "Appointment" ? "Schedule" : "Purchase"
      const eventId = `${lead.id}:${eventName}`
      await prisma.conversionDispatch.upsert({
        where: {
          organizationId_eventId: {
            organizationId: req.auth!.organizationId,
            eventId,
          },
        },
        update: { status: "queued", lastError: null },
        create: {
          organizationId: req.auth!.organizationId,
          leadId: lead.id,
          eventName,
          eventId,
          payload: { lead_id: lead.metaLeadId, event_time: Math.floor(Date.now() / 1000) },
        },
      })
    }
    if (input.leadStatus === "Converted" || input.consentStatus === "revoked") {
      await prisma.automationEnrollment.updateMany({
        where: {
          organizationId: req.auth!.organizationId,
          leadId: lead.id,
          status: "active",
        },
        data: {
          status: "paused",
          pausedReason: input.leadStatus === "Converted"
            ? "Lead converted"
            : "Communication consent revoked",
        },
      })
    }
    await audit(req, "lead.updated", "lead", lead.id, input)
    res.json({ data: lead })
  } catch (error) { next(error) }
})

coreRouter.get("/leads/:id/activity", requirePermission("leads.read"), async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.activityEvent.findMany({
      where: { organizationId: req.auth!.organizationId, leadId: String(req.params.id) },
      orderBy: { occurredAt: "desc" },
      take: 200,
    })
    res.json({ data })
  } catch (error) { next(error) }
})

coreRouter.get("/followups", requirePermission("leads.read"), async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.followUp.findMany({
      where: {
        organizationId: req.auth!.organizationId,
        deleted: false,
        ...(req.query.leadId ? { leadId: String(req.query.leadId) } : {}),
      },
      orderBy: { followUpDate: "asc" },
    })
    const leads = await prisma.lead.findMany({
      where: {
        organizationId: req.auth!.organizationId,
        id: { in: [...new Set(data.map((item) => item.leadId))] },
        deleted: false,
      },
      select: {
        id: true,
        leadName: true,
        leadEmail: true,
        leadPhoneNumber: true,
        phoneE164: true,
        leadStatus: true,
      },
    })
    res.json({
      data: data.map((followUp) => ({
        ...followUp,
        lead: leads.find((lead) => lead.id === followUp.leadId) || null,
      })),
    })
  } catch (error) { next(error) }
})

coreRouter.post("/followups", requirePermission("leads.write"), async (req: AuthRequest, res, next) => {
  try {
    const input = followUpInput.parse(req.body)
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, organizationId: req.auth!.organizationId, deleted: false },
    })
    if (!lead) {
      res.status(404).json({ error: "Lead not found" })
      return
    }
    const followUp = await prisma.followUp.create({
      data: {
        ...input,
        organizationId: req.auth!.organizationId,
        ownerId: input.ownerId || lead.assignedTo || req.auth!.userId,
        createdBy: req.auth!.userId,
      },
    })
    await prisma.lead.update({
      where: { id: lead.id },
      data: { nextFollowUpDate: followUp.followUpDate },
    })
    await prisma.activityEvent.create({
      data: {
        organizationId: req.auth!.organizationId,
        leadId: lead.id,
        actorUserId: req.auth!.userId,
        type: "followup.scheduled",
        title: `${followUp.followUpType} follow-up scheduled`,
        metadata: { followUpId: followUp.id, scheduledAt: followUp.followUpDate },
      },
    })
    res.status(201).json({ data: followUp })
  } catch (error) { next(error) }
})

coreRouter.patch("/followups/:id", requirePermission("leads.write"), async (req: AuthRequest, res, next) => {
  try {
    const input = followUpPatch.parse(req.body)
    const existing = await prisma.followUp.findFirst({
      where: { id: String(req.params.id), organizationId: req.auth!.organizationId, deleted: false },
    })
    if (!existing) {
      res.status(404).json({ error: "Follow-up not found" })
      return
    }
    const { leadStatus, ...followUpData } = input
    const data = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.followUp.update({
        where: { id: existing.id },
        data: {
          ...followUpData,
          ...(input.status === "completed" ? { completedAt: new Date() } : {}),
        },
      })
      if (leadStatus) {
        await transaction.lead.updateMany({
          where: {
            id: existing.leadId,
            organizationId: req.auth!.organizationId,
            deleted: false,
          },
          data: {
            leadStatus,
            ...(leadStatus === "Converted" ? { convertedAt: new Date() } : {}),
          },
        })
      }
      await transaction.activityEvent.create({
        data: {
          organizationId: req.auth!.organizationId,
          leadId: existing.leadId,
          actorUserId: req.auth!.userId,
          type: input.status === "completed" ? "followup.completed" : "followup.updated",
          title: input.status === "completed" ? "Follow-up completed" : "Follow-up updated",
          metadata: { followUpId: existing.id, status: input.status, leadStatus },
        },
      })
      return updated
    })
    res.json({ data })
  } catch (error) { next(error) }
})

coreRouter.delete("/followups/:id", requirePermission("leads.write"), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.followUp.findFirst({
      where: { id: String(req.params.id), organizationId: req.auth!.organizationId, deleted: false },
    })
    if (!existing) {
      res.status(404).json({ error: "Follow-up not found" })
      return
    }
    const data = await prisma.followUp.update({
      where: { id: existing.id },
      data: { deleted: true, status: "cancelled" },
    })
    await audit(req, "followup.deleted", "followup", existing.id, { leadId: existing.leadId })
    res.json({ data })
  } catch (error) { next(error) }
})

coreRouter.get("/followups/:id/script", requirePermission("leads.read"), async (req: AuthRequest, res, next) => {
  try {
    const followUp = await prisma.followUp.findFirst({
      where: { id: String(req.params.id), organizationId: req.auth!.organizationId, deleted: false },
    })
    if (!followUp) {
      res.status(404).json({ error: "Follow-up not found" })
      return
    }
    const lead = await prisma.lead.findFirst({
      where: { id: followUp.leadId, organizationId: req.auth!.organizationId, deleted: false },
    })
    if (!lead) {
      res.status(404).json({ error: "Lead not found" })
      return
    }
    const greeting = `Hello ${lead.leadName || "there"}, this is ${req.auth!.membershipRole === "agent" ? "your property advisor" : "the MooNsEstate team"}.`
    const context = followUp.notes?.trim()
      ? `I am following up about ${followUp.notes.trim().replace(/[.!?]+$/, "")}.`
      : "I am following up on your property enquiry."
    const nextStep = followUp.followUpType === "site_visit"
      ? "Would you like to confirm a convenient date and time for the site visit?"
      : followUp.followUpType === "call"
        ? "Is now a convenient time to discuss your budget, preferred locality, and move-in timeline?"
        : "Please let me know which property details or next step would be most useful."
    res.json({
      data: {
        script: `${greeting}\n\n${context} ${nextStep}\n\nIf you prefer not to receive further updates, please tell me and I will update your communication preferences.`,
        generatedBy: "workspace_template",
      },
    })
  } catch (error) { next(error) }
})

coreRouter.get("/automation-sequences", requirePermission("leads.read"), async (req: AuthRequest, res, next) => {
  try {
    await ensureDefaultAutomationSequences(req.auth!.organizationId)
    const [data, counts] = await Promise.all([
      prisma.automationSequence.findMany({
        where: {
          organizationId: req.auth!.organizationId,
          ...(req.query.status ? { status: String(req.query.status) } : {}),
        },
        orderBy: { name: "asc" },
      }),
      prisma.automationEnrollment.groupBy({
        by: ["sequenceId"],
        where: { organizationId: req.auth!.organizationId, status: "active" },
        _count: { _all: true },
      }),
    ])
    res.json({
      data: data.map((sequence) => ({
        ...sequence,
        activeEnrollments: counts.find((item) => item.sequenceId === sequence.id)?._count._all || 0,
      })),
    })
  } catch (error) { next(error) }
})

coreRouter.post("/automation-sequences", requirePermission("leads.write"), async (req: AuthRequest, res, next) => {
  try {
    if (!canManageSales(req.auth?.membershipRole)) {
      res.status(403).json({ error: "Sales manager access is required to create automations" })
      return
    }
    const input = automationSequenceInput.parse(req.body)
    const data = await prisma.automationSequence.create({
      data: {
        ...input,
        organizationId: req.auth!.organizationId,
        steps: JSON.parse(JSON.stringify(input.steps)),
        createdBy: req.auth!.userId,
      },
    })
    await audit(req, "automation.created", "automation_sequence", data.id)
    res.status(201).json({ data })
  } catch (error) { next(error) }
})

coreRouter.post(
  "/automation-sequences/:id/enroll",
  requirePermission("leads.write"),
  async (req: AuthRequest, res, next) => {
    try {
      const leadId = z.string().uuid().parse(req.body?.leadId)
      const [sequence, lead] = await Promise.all([
        prisma.automationSequence.findFirst({
          where: { id: String(req.params.id), organizationId: req.auth!.organizationId, status: "active" },
        }),
        prisma.lead.findFirst({
          where: { id: leadId, organizationId: req.auth!.organizationId, deleted: false },
        }),
      ])
      if (!sequence || !lead) {
        res.status(404).json({ error: "Automation sequence or lead not found" })
        return
      }
      if (lead.consentStatus === "revoked" || lead.leadStatus === "Converted") {
        res.status(409).json({
          error: lead.consentStatus === "revoked"
            ? "Automation cannot start because communication consent is revoked"
            : "Automation cannot start for a converted lead",
        })
        return
      }
      const steps = z.array(automationStepInput).parse(sequence.steps)
      const startedAt = new Date()
      const data = await prisma.$transaction(async (transaction) => {
        const enrollment = await transaction.automationEnrollment.create({
          data: {
            organizationId: req.auth!.organizationId,
            sequenceId: sequence.id,
            leadId: lead.id,
            nextRunAt: new Date(startedAt.getTime() + steps[0]!.offsetMinutes * 60_000),
            createdBy: req.auth!.userId,
          },
        })
        await transaction.followUp.createMany({
          data: steps.map((step, index) => ({
            organizationId: req.auth!.organizationId,
            leadId: lead.id,
            ownerId: lead.assignedTo || req.auth!.userId,
            followUpType: step.channel === "task" ? "other" : step.channel,
            followUpDate: new Date(startedAt.getTime() + step.offsetMinutes * 60_000),
            priority: step.priority,
            status: "pending",
            notes: step.notes,
            providerJobId: `automation:${enrollment.id}:${index}`,
            createdBy: req.auth!.userId,
          })),
        })
        await transaction.activityEvent.create({
          data: {
            organizationId: req.auth!.organizationId,
            leadId: lead.id,
            actorUserId: req.auth!.userId,
            type: "automation.enrolled",
            title: `Enrolled in ${sequence.name}`,
            metadata: { sequenceId: sequence.id, enrollmentId: enrollment.id, steps: steps.length },
          },
        })
        return enrollment
      })
      res.status(201).json({ data })
    } catch (error) { next(error) }
  },
)

coreRouter.get("/automation-enrollments", requirePermission("leads.read"), async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.automationEnrollment.findMany({
      where: {
        organizationId: req.auth!.organizationId,
        ...(req.query.leadId ? { leadId: String(req.query.leadId) } : {}),
        ...(req.query.status ? { status: String(req.query.status) } : {}),
      },
      orderBy: { createdDate: "desc" },
      take: 200,
    })
    const sequences = await prisma.automationSequence.findMany({
      where: {
        organizationId: req.auth!.organizationId,
        id: { in: [...new Set(data.map((item) => item.sequenceId))] },
      },
    })
    res.json({
      data: data.map((enrollment) => ({
        ...enrollment,
        sequence: sequences.find((sequence) => sequence.id === enrollment.sequenceId) || null,
      })),
    })
  } catch (error) { next(error) }
})

coreRouter.patch(
  "/automation-enrollments/:id",
  requirePermission("leads.write"),
  async (req: AuthRequest, res, next) => {
    try {
      const input = z.object({
        status: z.enum(["active", "paused", "cancelled"]),
        pausedReason: z.string().trim().max(2_000).optional().nullable(),
      }).parse(req.body)
      const enrollment = await prisma.automationEnrollment.findFirst({
        where: { id: String(req.params.id), organizationId: req.auth!.organizationId },
      })
      if (!enrollment) {
        res.status(404).json({ error: "Automation enrollment not found" })
        return
      }
      const data = await prisma.automationEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: input.status,
          pausedReason: input.status === "active" ? null : input.pausedReason,
        },
      })
      res.json({ data })
    } catch (error) { next(error) }
  },
)

coreRouter.get("/site-visits", requirePermission("leads.read"), async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.siteVisit.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { scheduledAt: "asc" },
    })
    res.json({ data })
  } catch (error) { next(error) }
})

coreRouter.post("/site-visits", requirePermission("leads.write"), async (req: AuthRequest, res, next) => {
  try {
    const input = siteVisitInput.parse(req.body)
    const data = await prisma.siteVisit.create({
      data: {
        ...input,
        organizationId: req.auth!.organizationId,
        assignedTo: input.assignedTo || req.auth!.userId,
      },
    })
    if (data.leadId) {
      await prisma.activityEvent.create({
        data: {
          organizationId: req.auth!.organizationId,
          leadId: data.leadId,
          propertyId: data.propertyId,
          actorUserId: req.auth!.userId,
          type: "site_visit.scheduled",
          title: "Site visit scheduled",
          metadata: { siteVisitId: data.id, scheduledAt: data.scheduledAt },
        },
      })
    }
    res.status(201).json({ data })
  } catch (error) { next(error) }
})

coreRouter.get(
  "/properties/:propertyId/inventory",
  requirePermission("properties.read"),
  async (req: AuthRequest, res, next) => {
    try {
      const context = await propertyInventoryContext(
        String(req.params.propertyId),
        req.auth!.organizationId,
      )
      if (!context) {
        res.status(404).json({ error: "Property not found" })
        return
      }
      if (!context.tower) {
        res.json({
          data: {
            propertyId: context.property.id,
            tower: null,
            units: [],
          },
        })
        return
      }
      res.json({
        data: {
          propertyId: context.property.id,
          tower: context.tower,
          units: await inventoryUnits(context.tower.id, context.property),
        },
      })
    } catch (error) { next(error) }
  },
)

coreRouter.post(
  "/properties/:propertyId/units",
  requirePermission("properties.write"),
  async (req: AuthRequest, res, next) => {
    try {
      const input = propertyUnitInput.parse(req.body)
      const context = await propertyInventoryContext(
        String(req.params.propertyId),
        req.auth!.organizationId,
        true,
      )
      if (!context) {
        res.status(404).json({ error: "Property not found" })
        return
      }
      if (!context.tower) {
        res.status(409).json({ error: "Set the tower, total floors, floor, and primary unit on this property first" })
        return
      }
      if (input.floorNumber > context.tower.totalFloors) {
        res.status(400).json({ error: `Floor must be between 1 and ${context.tower.totalFloors}` })
        return
      }

      const floor = await prisma.propertyFloor.upsert({
        where: {
          towerId_floorNumber: {
            towerId: context.tower.id,
            floorNumber: input.floorNumber,
          },
        },
        update: {},
        create: {
          organizationId: req.auth!.organizationId,
          towerId: context.tower.id,
          floorNumber: input.floorNumber,
          label: `Floor ${input.floorNumber}`,
        },
      })
      const existing = await prisma.propertyUnit.findUnique({
        where: {
          floorId_unitNumber: {
            floorId: floor.id,
            unitNumber: input.unitNumber,
          },
        },
      })
      if (existing) {
        res.status(409).json({ error: `Unit ${input.unitNumber} already exists on floor ${input.floorNumber}` })
        return
      }

      const unit = await prisma.propertyUnit.create({
        data: {
          organizationId: req.auth!.organizationId,
          floorId: floor.id,
          propertyId: context.property.id,
          unitNumber: input.unitNumber,
          bedrooms: input.bedrooms,
          bathrooms: input.bathrooms,
          carpetArea: input.carpetArea,
          facing: input.facing,
          listingPrice: input.listingPrice,
          status: input.status,
        },
      })
      await Promise.all([
        prisma.availabilityEvent.create({
          data: {
            organizationId: req.auth!.organizationId,
            propertyUnitId: unit.id,
            toStatus: unit.status,
            actorUserId: req.auth!.userId,
          },
        }),
        audit(req, "property_unit.created", "property_unit", unit.id, {
          propertyId: context.property.id,
          floorNumber: input.floorNumber,
          unitNumber: unit.unitNumber,
        }),
      ])
      res.status(201).json({
        data: {
          ...unit,
          floorNumber: floor.floorNumber,
          isPrimary: false,
        },
      })
    } catch (error) { next(error) }
  },
)

coreRouter.patch(
  "/properties/:propertyId/units/:unitId",
  requirePermission("properties.write"),
  async (req: AuthRequest, res, next) => {
    try {
      const input = propertyUnitPatch.parse(req.body)
      const context = await propertyInventoryContext(
        String(req.params.propertyId),
        req.auth!.organizationId,
      )
      if (!context || !context.tower) {
        res.status(404).json({ error: "Property inventory not found" })
        return
      }
      const unit = await prisma.propertyUnit.findFirst({
        where: { id: String(req.params.unitId), organizationId: req.auth!.organizationId },
      })
      if (!unit) {
        res.status(404).json({ error: "Unit not found" })
        return
      }
      const currentFloor = await prisma.propertyFloor.findFirst({
        where: { id: unit.floorId, towerId: context.tower.id },
      })
      if (!currentFloor) {
        res.status(404).json({ error: "Unit is not part of this tower" })
        return
      }

      const floorNumber = input.floorNumber ?? currentFloor.floorNumber
      if (floorNumber > context.tower.totalFloors) {
        res.status(400).json({ error: `Floor must be between 1 and ${context.tower.totalFloors}` })
        return
      }
      const floor = floorNumber === currentFloor.floorNumber
        ? currentFloor
        : await prisma.propertyFloor.upsert({
            where: {
              towerId_floorNumber: {
                towerId: context.tower.id,
                floorNumber,
              },
            },
            update: {},
            create: {
              organizationId: req.auth!.organizationId,
              towerId: context.tower.id,
              floorNumber,
              label: `Floor ${floorNumber}`,
            },
          })
      const unitNumber = input.unitNumber ?? unit.unitNumber
      const duplicate = await prisma.propertyUnit.findUnique({
        where: { floorId_unitNumber: { floorId: floor.id, unitNumber } },
      })
      if (duplicate && duplicate.id !== unit.id) {
        res.status(409).json({ error: `Unit ${unitNumber} already exists on floor ${floorNumber}` })
        return
      }

      const wasPrimary = unit.propertyId === context.property.id
        && unit.unitNumber === context.property.unitNumber
        && currentFloor.floorNumber === context.property.floorNumber
      const updated = await prisma.propertyUnit.update({
        where: { id: unit.id },
        data: {
          floorId: floor.id,
          unitNumber,
          bedrooms: input.bedrooms,
          bathrooms: input.bathrooms,
          carpetArea: input.carpetArea,
          facing: input.facing,
          listingPrice: input.listingPrice,
          status: input.status,
        },
      })
      if (wasPrimary) {
        await prisma.property.update({
          where: { id: context.property.id },
          data: {
            floorNumber,
            unitNumber,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            carpetArea: input.carpetArea,
            facing: input.facing,
            listingPrice: input.listingPrice === undefined
              ? undefined
              : input.listingPrice === null
                ? null
                : String(input.listingPrice),
            status: input.status,
          },
        })
      }
      if (input.status && input.status !== unit.status) {
        await prisma.availabilityEvent.create({
          data: {
            organizationId: req.auth!.organizationId,
            propertyUnitId: unit.id,
            fromStatus: unit.status,
            toStatus: input.status,
            actorUserId: req.auth!.userId,
          },
        })
      }
      await audit(req, "property_unit.updated", "property_unit", unit.id, {
        propertyId: context.property.id,
        floorNumber,
        unitNumber,
      })
      res.json({
        data: {
          ...updated,
          floorNumber,
          isPrimary: wasPrimary,
        },
      })
    } catch (error) { next(error) }
  },
)

coreRouter.delete(
  "/properties/:propertyId/units/:unitId",
  requirePermission("properties.write"),
  async (req: AuthRequest, res, next) => {
    try {
      const context = await propertyInventoryContext(
        String(req.params.propertyId),
        req.auth!.organizationId,
      )
      if (!context || !context.tower) {
        res.status(404).json({ error: "Property inventory not found" })
        return
      }
      const unit = await prisma.propertyUnit.findFirst({
        where: { id: String(req.params.unitId), organizationId: req.auth!.organizationId },
      })
      if (!unit) {
        res.status(404).json({ error: "Unit not found" })
        return
      }
      const floor = await prisma.propertyFloor.findFirst({
        where: { id: unit.floorId, towerId: context.tower.id },
      })
      if (!floor) {
        res.status(404).json({ error: "Unit is not part of this tower" })
        return
      }
      const isPrimary = unit.propertyId === context.property.id
        && unit.unitNumber === context.property.unitNumber
        && floor.floorNumber === context.property.floorNumber
      if (isPrimary) {
        res.status(409).json({ error: "The primary listing unit cannot be deleted here; edit or remove the property listing instead" })
        return
      }

      await prisma.$transaction([
        prisma.availabilityEvent.deleteMany({ where: { propertyUnitId: unit.id } }),
        prisma.propertyUnit.delete({ where: { id: unit.id } }),
      ])
      await audit(req, "property_unit.deleted", "property_unit", unit.id, {
        propertyId: context.property.id,
        floorNumber: floor.floorNumber,
        unitNumber: unit.unitNumber,
      })
      res.status(204).end()
    } catch (error) { next(error) }
  },
)

coreRouter.get("/geocode", requirePermission("properties.read"), async (req: AuthRequest, res, next) => {
  try {
    const query = z.string().trim().min(3).max(200).parse(req.query.q)
    res.setHeader("Cache-Control", "private, max-age=3600")
    res.json({ data: await geocodeAddress(query), attribution: "© OpenStreetMap contributors" })
  } catch (error) { next(error) }
})

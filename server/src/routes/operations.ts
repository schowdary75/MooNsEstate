import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { Router } from "express"
import { z } from "zod"
import prisma from "../../db/prisma.js"
import { requireAuth, requirePermission, type AuthRequest } from "../auth.js"
import { env } from "../env.js"
import { requireWritableSubscription } from "../entitlements.js"

const UNIT_STATUSES = ["Available", "Hold", "Reserved", "Booked", "Sold", "Blocked", "Cancelled"] as const
const ACTIVE_DEAL_STATUSES = ["Reserved", "AgreementExecuted"]
const FINANCIAL_ROLES = new Set(["platform_owner", "organization_owner", "organization_admin", "sales_manager", "finance"])

class OperationalError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

const projectInput = z.object({
  name: z.string().trim().min(2).max(180),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180).optional(),
  developerId: z.string().uuid().optional().nullable(),
  builder: z.string().trim().max(180).optional().nullable(),
  location: z.string().trim().max(500).optional().nullable(),
  address: z.string().max(2_000).optional().nullable(),
  reraId: z.string().trim().max(180).optional().nullable(),
  description: z.string().max(10_000).optional().nullable(),
  possessionDate: z.coerce.date().optional().nullable(),
  published: z.boolean().default(false),
})

const developerInput = z.object({
  name: z.string().trim().min(2).max(180),
  legalName: z.string().trim().max(240).optional().nullable(),
  profileType: z.enum(["Builder", "Developer", "Builder & Developer"]).default("Developer"),
  reraRegistration: z.string().trim().max(180).optional().nullable(),
  gstin: z.string().trim().max(40).optional().nullable(),
  website: z.string().trim().url().optional().or(z.literal("")).nullable(),
  email: z.string().trim().email().optional().or(z.literal("")).nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  contactPerson: z.string().trim().max(180).optional().nullable(),
  address: z.string().max(2_000).optional().nullable(),
  status: z.enum(["Active", "Inactive", "Suspended"]).default("Active"),
  notes: z.string().max(5_000).optional().nullable(),
})

const unitTemplateInput = z.object({
  unitType: z.string().trim().max(80).optional().nullable(),
  bedrooms: z.number().int().min(0).max(20).optional().nullable(),
  bathrooms: z.number().int().min(0).max(30).optional().nullable(),
  carpetArea: z.number().int().positive().max(1_000_000).optional().nullable(),
  saleableArea: z.number().int().positive().max(1_000_000).optional().nullable(),
  facing: z.string().trim().max(80).optional().nullable(),
  listingPrice: z.number().min(0).max(10_000_000_000_000).optional().nullable(),
  baseCost: z.number().min(0).max(10_000_000_000_000).optional().nullable(),
  status: z.enum(UNIT_STATUSES).default("Available"),
})

const generationExceptionInput = z.object({
  floorNumber: z.number().int().min(0).max(500).optional(),
  sequence: z.number().int().min(1).max(500),
  unitNumber: z.string().trim().min(1).max(80).optional(),
  omit: z.boolean().optional(),
  overrides: unitTemplateInput.partial().optional(),
})

const inventoryGenerationInput = z.object({
  structure: z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(180),
    kind: z.enum(["Tower", "Block", "Phase", "VillaPhase", "PlotLayout", "CommercialWing"]).default("Tower"),
    totalLevels: z.number().int().min(1).max(500).optional().nullable(),
  }),
  floorRange: z.object({
    from: z.number().int().min(0).max(500),
    to: z.number().int().min(0).max(500),
  }).optional().nullable(),
  excludedFloors: z.array(z.number().int().min(0).max(500)).max(500).default([]),
  unitsPerFloor: z.number().int().min(1).max(200),
  numbering: z.object({
    pattern: z.string().trim().min(1).max(80).default("{floor}{sequence:02}"),
    prefix: z.string().max(20).default(""),
    suffix: z.string().max(20).default(""),
  }).default({ pattern: "{floor}{sequence:02}", prefix: "", suffix: "" }),
  unitTemplate: unitTemplateInput.default({ status: "Available" }),
  exceptions: z.array(generationExceptionInput).max(5_000).default([]),
})

const dealInput = z.object({
  unitId: z.string().uuid(),
  leadId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  buyerProfileId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  assignedAgentId: z.string().uuid().optional().nullable(),
  grossPrice: z.number().min(0).max(10_000_000_000_000),
  discount: z.number().min(0).max(10_000_000_000_000).default(0),
  taxes: z.number().min(0).max(10_000_000_000_000).default(0),
  baseCost: z.number().min(0).max(10_000_000_000_000).optional(),
  brokerage: z.number().min(0).max(10_000_000_000_000).default(0),
  directExpenses: z.number().min(0).max(10_000_000_000_000).default(0),
  agencyCommission: z.number().min(0).max(10_000_000_000_000).default(0),
  paymentSchedule: z.array(z.object({
    label: z.string().trim().min(1).max(180),
    dueDate: z.coerce.date(),
    amount: z.number().min(0),
  })).max(100).optional(),
})

const paymentInput = z.object({
  amount: z.number().positive().max(10_000_000_000_000),
  reference: z.string().trim().max(180).optional(),
  paymentMethod: z.string().trim().max(80).optional(),
  paidAt: z.coerce.date(),
  status: z.enum(["Pending", "Confirmed", "Failed", "Reversed"]).default("Confirmed"),
  notes: z.string().max(2_000).optional(),
})

const expenseInput = z.object({
  category: z.enum(["Legal", "Marketing", "Registration", "Brokerage", "Financing", "Other"]),
  description: z.string().trim().max(500).optional(),
  amount: z.number().positive().max(10_000_000_000_000),
  incurredAt: z.coerce.date(),
})

type GenerationInput = z.infer<typeof inventoryGenerationInput>
type GeneratedUnit = {
  floorNumber: number | null
  sequence: number
  unitNumber: string
  unitType?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  carpetArea?: number | null
  saleableArea?: number | null
  facing?: string | null
  listingPrice?: number | null
  baseCost?: number | null
  status: typeof UNIT_STATUSES[number]
}

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 170)

const renderUnitNumber = (
  pattern: string,
  floorNumber: number | null,
  sequence: number,
  prefix: string,
  suffix: string,
) => {
  const rendered = pattern
    .replaceAll("{floor}", floorNumber === null ? "" : String(floorNumber))
    .replace(/\{floor:(\d+)\}/g, (_match, width) => String(floorNumber ?? "").padStart(Number(width), "0"))
    .replaceAll("{sequence}", String(sequence))
    .replace(/\{sequence:(\d+)\}/g, (_match, width) => String(sequence).padStart(Number(width), "0"))
  return `${prefix}${rendered}${suffix}`
}

const generateUnits = (input: GenerationInput): GeneratedUnit[] => {
  if (input.floorRange && input.floorRange.from > input.floorRange.to) {
    throw new OperationalError("The first floor must be lower than or equal to the last floor")
  }
  const excluded = new Set(input.excludedFloors)
  const floors: Array<number | null> = input.floorRange
    ? Array.from(
        { length: input.floorRange.to - input.floorRange.from + 1 },
        (_, index) => input.floorRange!.from + index,
      ).filter((floor) => !excluded.has(floor))
    : [null]
  const exceptions = new Map(
    input.exceptions.map((item) => [`${item.floorNumber ?? "none"}:${item.sequence}`, item]),
  )
  const generated: GeneratedUnit[] = []
  for (const floorNumber of floors) {
    for (let sequence = 1; sequence <= input.unitsPerFloor; sequence += 1) {
      const exception = exceptions.get(`${floorNumber ?? "none"}:${sequence}`)
      if (exception?.omit) continue
      generated.push({
        floorNumber,
        sequence,
        unitNumber: exception?.unitNumber || renderUnitNumber(
          input.numbering.pattern,
          floorNumber,
          sequence,
          input.numbering.prefix,
          input.numbering.suffix,
        ),
        ...input.unitTemplate,
        ...exception?.overrides,
        status: exception?.overrides?.status || input.unitTemplate.status,
      })
    }
  }
  const duplicates = generated.filter((unit, index) =>
    generated.findIndex((candidate) => candidate.unitNumber === unit.unitNumber) !== index)
  if (duplicates.length) {
    throw new OperationalError(`The numbering pattern creates duplicate unit ${duplicates[0]!.unitNumber}`)
  }
  if (!generated.length) throw new OperationalError("The template does not generate any units")
  return generated
}

const signPreview = (payload: object) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = createHmac("sha256", env.JWT_SECRET).update(body).digest("base64url")
  return `${body}.${signature}`
}

const verifyPreview = (token: string) => {
  const [body, provided] = token.split(".")
  if (!body || !provided) throw new OperationalError("The inventory preview token is invalid")
  const expected = createHmac("sha256", env.JWT_SECRET).update(body).digest()
  const actual = Buffer.from(provided, "base64url")
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new OperationalError("The inventory preview token is invalid")
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
    organizationId: string
    projectId: string
    expiresAt: number
    input: GenerationInput
  }
  if (payload.expiresAt < Date.now()) throw new OperationalError("The inventory preview has expired; preview it again")
  return payload
}

const decimalNumber = (value: unknown) => Number(value || 0)

const financialDeal = (deal: Record<string, unknown>) => ({
  ...deal,
  grossPrice: decimalNumber(deal.grossPrice),
  discount: decimalNumber(deal.discount),
  netSaleValue: decimalNumber(deal.netSaleValue),
  taxes: decimalNumber(deal.taxes),
  baseCost: decimalNumber(deal.baseCost),
  brokerage: decimalNumber(deal.brokerage),
  directExpenses: decimalNumber(deal.directExpenses),
  agencyCommission: decimalNumber(deal.agencyCommission),
  developerGrossProfit:
    decimalNumber(deal.netSaleValue)
    - decimalNumber(deal.baseCost)
    - decimalNumber(deal.brokerage)
    - decimalNumber(deal.directExpenses),
})

const timezoneOffsetMs = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const represented = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  )
  return represented - date.getTime()
}

const localMidnightUtc = (dateText: string, timezone: string) => {
  const [year, month, day] = dateText.split("-").map(Number)
  if (!year || !month || !day) throw new OperationalError("Dates must use YYYY-MM-DD")
  const guess = new Date(Date.UTC(year, month - 1, day))
  const first = new Date(guess.getTime() - timezoneOffsetMs(guess, timezone))
  return new Date(guess.getTime() - timezoneOffsetMs(first, timezone))
}

const nextDateText = (dateText: string) => {
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = dateText.split("-").map(Number)
  if (!year || !month || !day) throw new OperationalError("Dates must use YYYY-MM-DD")
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

const localToday = (timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const audit = (
  req: AuthRequest,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) => prisma.auditEvent.create({
  data: {
    organizationId: req.auth!.organizationId,
    actorUserId: req.auth!.userId,
    action,
    entityType,
    entityId,
    ipAddress: req.ip,
    metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
  },
})

export const operationsRouter = Router()
operationsRouter.use(requireAuth)
operationsRouter.use(requireWritableSubscription)

operationsRouter.get("/developers", requirePermission("properties.read"), async (req: AuthRequest, res, next) => {
  try {
    const developers = await prisma.developerProfile.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    })
    const projects = developers.length
      ? await prisma.realEstateProject.findMany({
          where: {
            organizationId: req.auth!.organizationId,
            developerId: { in: developers.map((developer) => developer.id) },
          },
          select: { id: true, developerId: true },
        })
      : []
    res.json({
      data: developers.map((developer) => ({
        ...developer,
        projectCount: projects.filter((project) => project.developerId === developer.id).length,
      })),
    })
  } catch (error) { next(error) }
})

operationsRouter.post("/developers", requirePermission("properties.write"), async (req: AuthRequest, res, next) => {
  try {
    const input = developerInput.parse(req.body)
    const developer = await prisma.developerProfile.create({
      data: {
        ...input,
        website: input.website || null,
        email: input.email || null,
        organizationId: req.auth!.organizationId,
        createdBy: req.auth!.userId,
      },
    })
    await audit(req, "developer.created", "developer_profile", developer.id)
    res.status(201).json({ data: developer })
  } catch (error) { next(error) }
})

operationsRouter.patch("/developers/:developerId", requirePermission("properties.write"), async (req: AuthRequest, res, next) => {
  try {
    const input = developerInput.partial().parse(req.body)
    const existing = await prisma.developerProfile.findFirst({
      where: { id: String(req.params.developerId), organizationId: req.auth!.organizationId },
    })
    if (!existing) {
      res.status(404).json({ error: "Builder or developer not found" })
      return
    }
    const developer = await prisma.developerProfile.update({
      where: { id: existing.id },
      data: {
        ...input,
        website: input.website === undefined ? undefined : input.website || null,
        email: input.email === undefined ? undefined : input.email || null,
      },
    })
    await audit(req, "developer.updated", "developer_profile", developer.id)
    res.json({ data: developer })
  } catch (error) { next(error) }
})

operationsRouter.get("/projects", requirePermission("properties.read"), async (req: AuthRequest, res, next) => {
  try {
    const projects = await prisma.realEstateProject.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { updatedDate: "desc" },
    })
    const structures = projects.length
      ? await prisma.inventoryStructure.findMany({
          where: { projectId: { in: projects.map((project) => project.id) } },
          orderBy: { name: "asc" },
        })
      : []
    const units = structures.length
      ? await prisma.inventoryUnit.findMany({
          where: { structureId: { in: structures.map((structure) => structure.id) } },
          select: { id: true, structureId: true, status: true, listingPrice: true },
        })
      : []
    res.json({
      data: projects.map((project) => {
        const projectStructures = structures.filter((structure) => structure.projectId === project.id)
        const projectUnits = units.filter((unit) =>
          projectStructures.some((structure) => structure.id === unit.structureId))
        return {
          ...project,
          structureCount: projectStructures.length,
          unitCount: projectUnits.length,
          availableUnits: projectUnits.filter((unit) => unit.status === "Available").length,
          soldUnits: projectUnits.filter((unit) => unit.status === "Sold").length,
          inventoryValue: projectUnits.reduce((sum, unit) => sum + decimalNumber(unit.listingPrice), 0),
        }
      }),
    })
  } catch (error) { next(error) }
})

operationsRouter.post("/projects", requirePermission("properties.write"), async (req: AuthRequest, res, next) => {
  try {
    const input = projectInput.parse(req.body)
    const developer = input.developerId
      ? await prisma.developerProfile.findFirst({
          where: { id: input.developerId, organizationId: req.auth!.organizationId, status: "Active" },
        })
      : null
    if (input.developerId && !developer) {
      res.status(400).json({ error: "Select an active builder or developer from this workspace" })
      return
    }
    let slug = input.slug || slugify(input.name)
    const collision = await prisma.realEstateProject.findUnique({
      where: { organizationId_slug: { organizationId: req.auth!.organizationId, slug } },
    })
    if (collision) slug = `${slug}-${randomUUID().slice(0, 6)}`
    const project = await prisma.realEstateProject.create({
      data: {
        ...input,
        builder: developer?.name || input.builder,
        slug,
        organizationId: req.auth!.organizationId,
      },
    })
    await audit(req, "project.created", "project", project.id)
    res.status(201).json({ data: project })
  } catch (error) { next(error) }
})

operationsRouter.post(
  "/projects/:projectId/inventory/generation-preview",
  requirePermission("inventory.manage"),
  async (req: AuthRequest, res, next) => {
    try {
      const input = inventoryGenerationInput.parse(req.body)
      const project = await prisma.realEstateProject.findFirst({
        where: { id: String(req.params.projectId), organizationId: req.auth!.organizationId },
      })
      if (!project) {
        res.status(404).json({ error: "Project not found" })
        return
      }
      const structure = input.structure.id
        ? await prisma.inventoryStructure.findFirst({
            where: { id: input.structure.id, projectId: project.id, organizationId: req.auth!.organizationId },
          })
        : await prisma.inventoryStructure.findUnique({
            where: { projectId_name: { projectId: project.id, name: input.structure.name } },
          })
      if (input.structure.id && !structure) {
        res.status(404).json({ error: "Inventory structure not found" })
        return
      }
      const units = generateUnits(input)
      const existing = structure
        ? await prisma.inventoryUnit.findMany({
            where: { structureId: structure.id, unitNumber: { in: units.map((unit) => unit.unitNumber) } },
            select: { id: true, unitNumber: true, status: true },
          })
        : []
      const conflicts = new Map(existing.map((unit) => [unit.unitNumber, unit]))
      const previewToken = signPreview({
        organizationId: req.auth!.organizationId,
        projectId: project.id,
        expiresAt: Date.now() + 15 * 60_000,
        input,
      })
      res.json({
        data: {
          previewToken,
          summary: {
            floors: new Set(units.map((unit) => unit.floorNumber).filter((floor) => floor !== null)).size,
            units: units.length,
            conflicts: existing.length,
            estimatedInventoryValue: units.reduce((sum, unit) => sum + Number(unit.listingPrice || 0), 0),
          },
          units: units.map((unit) => ({
            ...unit,
            conflict: conflicts.get(unit.unitNumber) || null,
          })),
          warnings: existing.length
            ? [`${existing.length} unit number${existing.length === 1 ? "" : "s"} already exist in this structure.`]
            : [],
        },
      })
    } catch (error) { next(error) }
  },
)

operationsRouter.post(
  "/projects/:projectId/inventory/generation-commit",
  requirePermission("inventory.manage"),
  async (req: AuthRequest, res, next) => {
    try {
      const body = z.object({
        previewToken: z.string().min(20),
        idempotencyKey: z.string().trim().min(8).max(180),
        conflictPolicy: z.enum(["reject", "skip"]).default("reject"),
      }).parse(req.body)
      const preview = verifyPreview(body.previewToken)
      const projectId = String(req.params.projectId)
      if (preview.organizationId !== req.auth!.organizationId || preview.projectId !== projectId) {
        res.status(403).json({ error: "The preview belongs to a different workspace or project" })
        return
      }
      const prior = await prisma.inventoryGenerationBatch.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: req.auth!.organizationId,
            idempotencyKey: body.idempotencyKey,
          },
        },
      })
      if (prior) {
        res.json({ data: prior, idempotentReplay: true })
        return
      }
      const generated = generateUnits(preview.input)
      const result = await prisma.$transaction(async (tx) => {
        const structure = preview.input.structure.id
          ? await tx.inventoryStructure.findFirstOrThrow({
              where: {
                id: preview.input.structure.id,
                projectId,
                organizationId: req.auth!.organizationId,
              },
            })
          : await tx.inventoryStructure.upsert({
              where: {
                projectId_name: {
                  projectId,
                  name: preview.input.structure.name,
                },
              },
              update: {
                kind: preview.input.structure.kind,
                totalLevels: preview.input.structure.totalLevels,
                unitNumberPattern: preview.input.numbering.pattern,
              },
              create: {
                organizationId: req.auth!.organizationId,
                projectId,
                name: preview.input.structure.name,
                kind: preview.input.structure.kind,
                totalLevels: preview.input.structure.totalLevels,
                unitNumberPattern: preview.input.numbering.pattern,
              },
            })
        const existing = await tx.inventoryUnit.findMany({
          where: { structureId: structure.id, unitNumber: { in: generated.map((unit) => unit.unitNumber) } },
          select: { unitNumber: true },
        })
        if (existing.length && body.conflictPolicy === "reject") {
          throw new OperationalError(`Generation stopped because unit ${existing[0]!.unitNumber} already exists`, 409)
        }
        const existingNumbers = new Set(existing.map((unit) => unit.unitNumber))
        const unitsToCreate = generated.filter((unit) => !existingNumbers.has(unit.unitNumber))
        const floorNumbers = [...new Set(
          unitsToCreate.map((unit) => unit.floorNumber).filter((floor): floor is number => floor !== null),
        )]
        const levels = new Map<number, string>()
        for (const floorNumber of floorNumbers) {
          const level = await tx.inventoryLevel.upsert({
            where: { structureId_levelNumber: { structureId: structure.id, levelNumber: floorNumber } },
            update: {},
            create: {
              organizationId: req.auth!.organizationId,
              structureId: structure.id,
              levelNumber: floorNumber,
              label: `Floor ${floorNumber}`,
            },
          })
          levels.set(floorNumber, level.id)
        }
        if (unitsToCreate.length) {
          await tx.inventoryUnit.createMany({
            data: unitsToCreate.map(({ floorNumber, sequence: _sequence, ...unit }) => ({
              ...unit,
              organizationId: req.auth!.organizationId,
              structureId: structure.id,
              levelId: floorNumber === null ? null : levels.get(floorNumber),
            })),
          })
        }
        return tx.inventoryGenerationBatch.create({
          data: {
            organizationId: req.auth!.organizationId,
            projectId,
            structureId: structure.id,
            idempotencyKey: body.idempotencyKey,
            request: JSON.parse(JSON.stringify(preview.input)),
            createdUnitCount: unitsToCreate.length,
            createdBy: req.auth!.userId,
          },
        })
      }, { isolationLevel: "Serializable" })
      await audit(req, "inventory.generated", "inventory_generation_batch", result.id, {
        projectId,
        createdUnitCount: result.createdUnitCount,
      })
      res.status(201).json({ data: result })
    } catch (error) { next(error) }
  },
)

operationsRouter.get(
  "/projects/:projectId/inventory",
  requirePermission("properties.read"),
  async (req: AuthRequest, res, next) => {
    try {
      const project = await prisma.realEstateProject.findFirst({
        where: { id: String(req.params.projectId), organizationId: req.auth!.organizationId },
      })
      if (!project) {
        res.status(404).json({ error: "Project not found" })
        return
      }
      const structures = await prisma.inventoryStructure.findMany({
        where: { projectId: project.id, organizationId: req.auth!.organizationId },
        orderBy: { name: "asc" },
      })
      const levels = structures.length
        ? await prisma.inventoryLevel.findMany({
            where: { structureId: { in: structures.map((item) => item.id) } },
            orderBy: { levelNumber: "asc" },
          })
        : []
      const units = structures.length
        ? await prisma.inventoryUnit.findMany({
            where: { structureId: { in: structures.map((item) => item.id) } },
            orderBy: [{ unitNumber: "asc" }],
          })
        : []
      res.json({
        data: {
          project,
          structures: structures.map((structure) => ({
            ...structure,
            levels: levels
              .filter((level) => level.structureId === structure.id)
              .map((level) => ({
                ...level,
                units: units.filter((unit) => unit.levelId === level.id),
              })),
            unlevelledUnits: units.filter((unit) => unit.structureId === structure.id && !unit.levelId),
          })),
        },
      })
    } catch (error) { next(error) }
  },
)

operationsRouter.get(
  "/projects/:projectId/overview",
  requirePermission("properties.read"),
  async (req: AuthRequest, res, next) => {
    try {
      const project = await prisma.realEstateProject.findFirst({
        where: { id: String(req.params.projectId), organizationId: req.auth!.organizationId },
      })
      if (!project) {
        res.status(404).json({ error: "Project not found" })
        return
      }
      const structures = await prisma.inventoryStructure.findMany({
        where: { projectId: project.id, organizationId: req.auth!.organizationId },
      })
      const units = structures.length
        ? await prisma.inventoryUnit.findMany({
            where: { structureId: { in: structures.map((item) => item.id) } },
          })
        : []
      const soldDeals = await prisma.salesDeal.findMany({
        where: {
          projectId: project.id,
          organizationId: req.auth!.organizationId,
          status: "AgreementExecuted",
        },
      })
      const byStatus = Object.fromEntries(UNIT_STATUSES.map((status) => [
        status,
        units.filter((unit) => unit.status === status).length,
      ]))
      res.json({
        data: {
          project,
          totals: {
            structures: structures.length,
            levels: structures.reduce((sum, structure) => sum + Number(structure.totalLevels || 0), 0),
            units: units.length,
            inventoryValue: units.reduce((sum, unit) => sum + decimalNumber(unit.listingPrice), 0),
            soldValue: soldDeals.reduce((sum, deal) => sum + decimalNumber(deal.netSaleValue), 0),
            absorptionRate: units.length ? Number((((byStatus.Sold || 0) / units.length) * 100).toFixed(1)) : 0,
          },
          byStatus,
          structures: structures.map((structure) => ({
            ...structure,
            units: units.filter((unit) => unit.structureId === structure.id).length,
            available: units.filter((unit) =>
              unit.structureId === structure.id && unit.status === "Available").length,
          })),
        },
      })
    } catch (error) { next(error) }
  },
)

operationsRouter.get(
  "/projects/:projectId/financial-summary",
  requirePermission("financials.read"),
  async (req: AuthRequest, res, next) => {
    try {
      const deals = await prisma.salesDeal.findMany({
        where: {
          organizationId: req.auth!.organizationId,
          projectId: String(req.params.projectId),
          status: "AgreementExecuted",
        },
      })
      const dealIds = deals.map((deal) => deal.id)
      const payments = dealIds.length
        ? await prisma.dealPayment.findMany({
            where: { dealId: { in: dealIds }, status: "Confirmed" },
          })
        : []
      const normalized = deals.map((deal) => financialDeal(deal as unknown as Record<string, unknown>))
      res.json({
        data: {
          unitsSold: deals.length,
          netSales: normalized.reduce((sum, deal) => sum + deal.netSaleValue, 0),
          developerGrossProfit: normalized.reduce((sum, deal) => sum + deal.developerGrossProfit, 0),
          agencyCommission: normalized.reduce((sum, deal) => sum + deal.agencyCommission, 0),
          collections: payments.reduce((sum, payment) => sum + decimalNumber(payment.amount), 0),
        },
      })
    } catch (error) { next(error) }
  },
)

operationsRouter.get("/deals", requirePermission("deals.read"), async (req: AuthRequest, res, next) => {
  try {
    const role = req.auth!.membershipRole || ""
    const ownDealsOnly = !FINANCIAL_ROLES.has(role)
    const deals = await prisma.salesDeal.findMany({
      where: {
        organizationId: req.auth!.organizationId,
        ...(ownDealsOnly ? { assignedAgentId: req.auth!.userId } : {}),
        ...(req.query.status ? { status: String(req.query.status) } : {}),
        ...(req.query.projectId ? { projectId: String(req.query.projectId) } : {}),
      },
      orderBy: { updatedDate: "desc" },
      take: 500,
    })
    const [units, structures, projects] = await Promise.all([
      prisma.inventoryUnit.findMany({
        where: { id: { in: deals.map((deal) => deal.unitId) }, organizationId: req.auth!.organizationId },
        select: { id: true, unitNumber: true, unitType: true },
      }),
      prisma.inventoryStructure.findMany({
        where: { id: { in: deals.map((deal) => deal.structureId) }, organizationId: req.auth!.organizationId },
        select: { id: true, name: true },
      }),
      prisma.realEstateProject.findMany({
        where: { id: { in: deals.map((deal) => deal.projectId) }, organizationId: req.auth!.organizationId },
        select: { id: true, name: true },
      }),
    ])
    const unitById = new Map(units.map((unit) => [unit.id, unit]))
    const structureById = new Map(structures.map((structure) => [structure.id, structure]))
    const projectById = new Map(projects.map((project) => [project.id, project]))
    res.json({
      data: deals.map((deal) => {
        const normalized = {
          ...financialDeal(deal as unknown as Record<string, unknown>),
          unitNumber: unitById.get(deal.unitId)?.unitNumber || "Unknown unit",
          unitType: unitById.get(deal.unitId)?.unitType || null,
          structureName: structureById.get(deal.structureId)?.name || "Unknown structure",
          projectName: projectById.get(deal.projectId)?.name || "Unknown project",
        }
        if (FINANCIAL_ROLES.has(role)) return normalized
        const { baseCost: _baseCost, brokerage: _brokerage, directExpenses: _directExpenses, developerGrossProfit: _profit, ...visible } = normalized
        return visible
      }),
    })
  } catch (error) { next(error) }
})

operationsRouter.post("/deals", requirePermission("deals.write"), async (req: AuthRequest, res, next) => {
  try {
    const input = dealInput.parse(req.body)
    if (input.discount > input.grossPrice) {
      res.status(400).json({ error: "Discount cannot exceed the gross price" })
      return
    }
    const unit = await prisma.inventoryUnit.findFirst({
      where: { id: input.unitId, organizationId: req.auth!.organizationId },
    })
    if (!unit) {
      res.status(404).json({ error: "Inventory unit not found" })
      return
    }
    const structure = await prisma.inventoryStructure.findFirstOrThrow({
      where: { id: unit.structureId, organizationId: req.auth!.organizationId },
    })
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: req.auth!.organizationId },
    })
    const deal = await prisma.salesDeal.create({
      data: {
        ...input,
        paymentSchedule: input.paymentSchedule
          ? JSON.parse(JSON.stringify(input.paymentSchedule))
          : undefined,
        organizationId: req.auth!.organizationId,
        projectId: structure.projectId,
        structureId: structure.id,
        assignedAgentId: input.assignedAgentId || req.auth!.userId,
        dealNumber: `DEAL-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`,
        currency: organization.currency,
        netSaleValue: input.grossPrice - input.discount,
        baseCost: input.baseCost ?? decimalNumber(unit.baseCost),
        createdBy: req.auth!.userId,
      },
    })
    await audit(req, "deal.created", "sales_deal", deal.id, { unitId: unit.id })
    res.status(201).json({ data: financialDeal(deal as unknown as Record<string, unknown>) })
  } catch (error) { next(error) }
})

operationsRouter.post(
  "/deals/:dealId/reserve",
  requirePermission("deals.write"),
  async (req: AuthRequest, res, next) => {
    try {
      const dealId = String(req.params.dealId)
      const deal = await prisma.$transaction(async (tx) => {
        const current = await tx.salesDeal.findFirstOrThrow({
          where: { id: dealId, organizationId: req.auth!.organizationId },
        })
        if (!["Draft", "Reserved"].includes(current.status)) throw new OperationalError("Only a draft deal can reserve a unit", 409)
        const competing = await tx.salesDeal.findFirst({
          where: {
            unitId: current.unitId,
            status: { in: ACTIVE_DEAL_STATUSES },
            id: { not: current.id },
          },
        })
        if (competing) throw new OperationalError("This unit is already reserved or sold in another deal", 409)
        const unit = await tx.inventoryUnit.findFirstOrThrow({
          where: { id: current.unitId, organizationId: req.auth!.organizationId },
        })
        if (!["Available", "Hold", "Reserved"].includes(unit.status)) {
          throw new OperationalError(`Unit ${unit.unitNumber} is ${unit.status} and cannot be reserved`, 409)
        }
        await tx.inventoryUnit.update({
          where: { id: unit.id },
          data: { status: "Reserved", statusChangedAt: new Date() },
        })
        return tx.salesDeal.update({
          where: { id: current.id },
          data: { status: "Reserved", reservedAt: current.reservedAt || new Date() },
        })
      }, { isolationLevel: "Serializable" })
      await audit(req, "deal.reserved", "sales_deal", deal.id, { unitId: deal.unitId })
      res.json({ data: financialDeal(deal as unknown as Record<string, unknown>) })
    } catch (error) { next(error) }
  },
)

operationsRouter.post(
  "/deals/:dealId/execute",
  requirePermission("deals.execute"),
  async (req: AuthRequest, res, next) => {
    try {
      const input = z.object({
        agreementNumber: z.string().trim().min(1).max(180),
        agreementExecutedAt: z.coerce.date().default(() => new Date()),
        documents: z.array(z.object({
          name: z.string().trim().min(1).max(180),
          url: z.string().url(),
        })).max(50).optional(),
      }).parse(req.body)
      const deal = await prisma.$transaction(async (tx) => {
        const current = await tx.salesDeal.findFirstOrThrow({
          where: { id: String(req.params.dealId), organizationId: req.auth!.organizationId },
        })
        if (!["Draft", "Reserved"].includes(current.status)) {
          throw new OperationalError("Only a draft or reserved deal can execute an agreement", 409)
        }
        const competing = await tx.salesDeal.findFirst({
          where: {
            unitId: current.unitId,
            status: { in: ACTIVE_DEAL_STATUSES },
            id: { not: current.id },
          },
        })
        if (competing) throw new OperationalError("This unit is already reserved or sold in another deal", 409)
        const soldUnit = await tx.inventoryUnit.update({
          where: { id: current.unitId },
          data: { status: "Sold", statusChangedAt: input.agreementExecutedAt },
        })
        if (soldUnit.legacyPropertyId) {
          await tx.propertyUnit.updateMany({
            where: {
              organizationId: req.auth!.organizationId,
              propertyId: soldUnit.legacyPropertyId,
              unitNumber: soldUnit.unitNumber,
            },
            data: { status: "Sold" },
          })
        }
        return tx.salesDeal.update({
          where: { id: current.id },
          data: {
            status: "AgreementExecuted",
            agreementNumber: input.agreementNumber,
            agreementExecutedAt: input.agreementExecutedAt,
            documents: input.documents ? JSON.parse(JSON.stringify(input.documents)) : undefined,
          },
        })
      }, { isolationLevel: "Serializable" })
      await audit(req, "deal.agreement_executed", "sales_deal", deal.id, {
        unitId: deal.unitId,
        agreementNumber: deal.agreementNumber,
        agreementExecutedAt: deal.agreementExecutedAt,
      })
      res.json({ data: financialDeal(deal as unknown as Record<string, unknown>) })
    } catch (error) { next(error) }
  },
)

operationsRouter.post(
  "/deals/:dealId/cancel",
  requirePermission("deals.execute"),
  async (req: AuthRequest, res, next) => {
    try {
      const input = z.object({ reason: z.string().trim().min(3).max(2_000) }).parse(req.body)
      const deal = await prisma.$transaction(async (tx) => {
        const current = await tx.salesDeal.findFirstOrThrow({
          where: { id: String(req.params.dealId), organizationId: req.auth!.organizationId },
        })
        if (current.status === "Cancelled") return current
        const updated = await tx.salesDeal.update({
          where: { id: current.id },
          data: { status: "Cancelled", cancelledAt: new Date(), cancellationReason: input.reason },
        })
        const competing = await tx.salesDeal.findFirst({
          where: {
            unitId: current.unitId,
            status: { in: ACTIVE_DEAL_STATUSES },
            id: { not: current.id },
          },
        })
        if (!competing) {
          const releasedUnit = await tx.inventoryUnit.update({
            where: { id: current.unitId },
            data: { status: "Available", statusChangedAt: new Date() },
          })
          if (releasedUnit.legacyPropertyId) {
            await tx.propertyUnit.updateMany({
              where: {
                organizationId: req.auth!.organizationId,
                propertyId: releasedUnit.legacyPropertyId,
                unitNumber: releasedUnit.unitNumber,
              },
              data: { status: "Available" },
            })
          }
        }
        return updated
      }, { isolationLevel: "Serializable" })
      await audit(req, "deal.cancelled", "sales_deal", deal.id, {
        unitId: deal.unitId,
        reason: input.reason,
      })
      res.json({ data: financialDeal(deal as unknown as Record<string, unknown>) })
    } catch (error) { next(error) }
  },
)

operationsRouter.post(
  "/deals/:dealId/payments",
  requirePermission("collections.manage"),
  async (req: AuthRequest, res, next) => {
    try {
      const input = paymentInput.parse(req.body)
      const deal = await prisma.salesDeal.findFirst({
        where: { id: String(req.params.dealId), organizationId: req.auth!.organizationId },
      })
      if (!deal) {
        res.status(404).json({ error: "Deal not found" })
        return
      }
      const payment = await prisma.dealPayment.create({
        data: {
          ...input,
          organizationId: req.auth!.organizationId,
          dealId: deal.id,
          currency: deal.currency,
          recordedBy: req.auth!.userId,
        },
      })
      await audit(req, "deal.payment_recorded", "deal_payment", payment.id, {
        dealId: deal.id,
        amount: input.amount,
        status: input.status,
      })
      res.status(201).json({ data: { ...payment, amount: decimalNumber(payment.amount) } })
    } catch (error) { next(error) }
  },
)

operationsRouter.post(
  "/deals/:dealId/expenses",
  requirePermission("financials.read"),
  async (req: AuthRequest, res, next) => {
    try {
      const input = expenseInput.parse(req.body)
      const expense = await prisma.$transaction(async (tx) => {
        const deal = await tx.salesDeal.findFirstOrThrow({
          where: { id: String(req.params.dealId), organizationId: req.auth!.organizationId },
        })
        const created = await tx.dealExpense.create({
          data: {
            ...input,
            organizationId: req.auth!.organizationId,
            dealId: deal.id,
            recordedBy: req.auth!.userId,
          },
        })
        await tx.salesDeal.update({
          where: { id: deal.id },
          data: { directExpenses: { increment: input.amount } },
        })
        return created
      })
      await audit(req, "deal.expense_recorded", "deal_expense", expense.id, {
        dealId: expense.dealId,
        amount: input.amount,
        category: input.category,
      })
      res.status(201).json({ data: { ...expense, amount: decimalNumber(expense.amount) } })
    } catch (error) { next(error) }
  },
)

operationsRouter.get(
  "/deals/:dealId/audit",
  requirePermission("deals.read"),
  async (req: AuthRequest, res, next) => {
    try {
      const deal = await prisma.salesDeal.findFirst({
        where: { id: String(req.params.dealId), organizationId: req.auth!.organizationId },
      })
      if (!deal || (!FINANCIAL_ROLES.has(req.auth!.membershipRole || "") && deal.assignedAgentId !== req.auth!.userId)) {
        res.status(404).json({ error: "Deal not found" })
        return
      }
      const data = await prisma.auditEvent.findMany({
        where: {
          organizationId: req.auth!.organizationId,
          OR: [
            { entityType: "sales_deal", entityId: deal.id },
            { metadata: { path: "$.dealId", equals: deal.id } },
          ],
        },
        orderBy: { createdDate: "desc" },
      })
      res.json({ data })
    } catch (error) { next(error) }
  },
)

operationsRouter.get(
  "/reports/sales-summary",
  requirePermission("reports.sales"),
  async (req: AuthRequest, res, next) => {
    try {
      const organization = await prisma.organization.findUniqueOrThrow({
        where: { id: req.auth!.organizationId },
      })
      const timezone = String(req.query.timezone || organization.timezone)
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone }).format()
      } catch {
        res.status(400).json({ error: "Unknown timezone" })
        return
      }
      const fromText = String(req.query.from || localToday(timezone))
      const toText = String(req.query.to || fromText)
      const from = localMidnightUtc(fromText, timezone)
      const until = localMidnightUtc(nextDateText(toText), timezone)
      const role = req.auth!.membershipRole || ""
      const ownDealsOnly = !FINANCIAL_ROLES.has(role)
      const common = {
        organizationId: req.auth!.organizationId,
        ...(ownDealsOnly ? { assignedAgentId: req.auth!.userId } : {}),
        ...(req.query.projectId ? { projectId: String(req.query.projectId) } : {}),
        ...(req.query.structureId ? { structureId: String(req.query.structureId) } : {}),
        ...(req.query.agentId && !ownDealsOnly ? { assignedAgentId: String(req.query.agentId) } : {}),
      }
      const [sales, cancellations, payments, allProjects, allStructures, allUnits, memberships] = await Promise.all([
        prisma.salesDeal.findMany({
          where: {
            ...common,
            status: "AgreementExecuted",
            agreementExecutedAt: { gte: from, lt: until },
          },
          orderBy: { agreementExecutedAt: "desc" },
        }),
        prisma.salesDeal.findMany({
          where: {
            ...common,
            status: "Cancelled",
            cancelledAt: { gte: from, lt: until },
          },
          orderBy: { cancelledAt: "desc" },
        }),
        prisma.dealPayment.findMany({
          where: {
            organizationId: req.auth!.organizationId,
            status: "Confirmed",
            paidAt: { gte: from, lt: until },
          },
          orderBy: { paidAt: "desc" },
        }),
        prisma.realEstateProject.findMany({ where: { organizationId: req.auth!.organizationId } }),
        prisma.inventoryStructure.findMany({ where: { organizationId: req.auth!.organizationId } }),
        prisma.inventoryUnit.findMany({ where: { organizationId: req.auth!.organizationId } }),
        prisma.membership.findMany({
          where: { organizationId: req.auth!.organizationId, status: "active" },
          include: { user: { select: { firstName: true, lastName: true, username: true } } },
        }),
      ])
      const visibleDealIds = new Set([...sales, ...cancellations].map((deal) => deal.id))
      const scopedPayments = payments.filter((payment) => visibleDealIds.has(payment.dealId)
        || (!req.query.projectId && !req.query.structureId && !req.query.agentId && !ownDealsOnly))
      const projects = new Map(allProjects.map((project) => [project.id, project]))
      const structures = new Map(allStructures.map((structure) => [structure.id, structure]))
      const units = new Map(allUnits.map((unit) => [unit.id, unit]))
      const agents = new Map(memberships.map((membership) => [
        membership.userId,
        [membership.user.firstName, membership.user.lastName].filter(Boolean).join(" ")
          || membership.user.username,
      ]))
      const normalized = sales.map((deal) => {
        const finance = financialDeal(deal as unknown as Record<string, unknown>)
        return {
          ...finance,
          projectName: projects.get(deal.projectId)?.name || "Unknown project",
          structureName: structures.get(deal.structureId)?.name || "Unknown structure",
          unitNumber: units.get(deal.unitId)?.unitNumber || "Unknown unit",
          unitType: units.get(deal.unitId)?.unitType || null,
          agentName: deal.assignedAgentId ? agents.get(deal.assignedAgentId) || "Unassigned" : "Unassigned",
          agreementExecutedAt: deal.agreementExecutedAt,
          assignedAgentId: deal.assignedAgentId,
        }
      })
      const includeFullFinancials = FINANCIAL_ROLES.has(role)
      const netSales = normalized.reduce((sum, deal) => sum + deal.netSaleValue, 0)
      const developerGrossProfit = normalized.reduce((sum, deal) => sum + deal.developerGrossProfit, 0)
      const agencyCommission = normalized.reduce((sum, deal) => sum + deal.agencyCommission, 0)
      const collections = scopedPayments.reduce((sum, payment) => sum + decimalNumber(payment.amount), 0)
      const daily = new Map<string, { date: string; unitsSold: number; netSales: number; collections: number }>()
      for (let cursor = fromText; cursor <= toText; cursor = nextDateText(cursor)) {
        daily.set(cursor, { date: cursor, unitsSold: 0, netSales: 0, collections: 0 })
      }
      for (const deal of normalized) {
        const date = new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(String(deal.agreementExecutedAt)))
        const bucket = daily.get(date)
        if (bucket) {
          bucket.unitsSold += 1
          bucket.netSales += deal.netSaleValue
        }
      }
      for (const payment of scopedPayments) {
        const date = new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(payment.paidAt)
        const bucket = daily.get(date)
        if (bucket) bucket.collections += decimalNumber(payment.amount)
      }
      const leaderboard = new Map<string, { agentId: string; agentName: string; unitsSold: number; netSales: number }>()
      for (const deal of normalized) {
        const agentId = String(deal.assignedAgentId || "unassigned")
        const row = leaderboard.get(agentId) || {
          agentId,
          agentName: deal.agentName,
          unitsSold: 0,
          netSales: 0,
        }
        row.unitsSold += 1
        row.netSales += deal.netSaleValue
        leaderboard.set(agentId, row)
      }
      res.json({
        data: {
          period: { from: fromText, to: toText, timezone, currency: organization.currency },
          kpis: {
            unitsSold: sales.length,
            netSales,
            developerGrossProfit: includeFullFinancials ? developerGrossProfit : null,
            agencyCommission,
            collections,
            cancellations: cancellations.length,
            averageSellingPrice: sales.length ? netSales / sales.length : 0,
            marginPercent: includeFullFinancials && netSales
              ? Number(((developerGrossProfit / netSales) * 100).toFixed(1))
              : null,
          },
          deals: normalized.map((deal) => {
            if (includeFullFinancials) return deal
            const { baseCost: _baseCost, brokerage: _brokerage, directExpenses: _expenses, developerGrossProfit: _profit, ...visible } = deal
            return visible
          }),
          cancellations: cancellations.map((deal) => ({
            id: deal.id,
            dealNumber: deal.dealNumber,
            cancelledAt: deal.cancelledAt,
            cancellationReason: deal.cancellationReason,
            unitNumber: units.get(deal.unitId)?.unitNumber || "Unknown unit",
          })),
          daily: [...daily.values()],
          agentLeaderboard: [...leaderboard.values()].sort((a, b) => b.netSales - a.netSales),
        },
      })
    } catch (error) { next(error) }
  },
)

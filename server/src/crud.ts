import { Prisma } from "@prisma/client"
import { Router, type Request, type Response } from "express"
import { randomUUID } from "node:crypto"
import prisma from "../db/prisma.js"
import { requireAuth, requirePermission, type AuthRequest } from "./auth.js"
import { requireWritableSubscription } from "./entitlements.js"

type ModelMeta = {
  name: string
  fields: Array<{ name: string; type: string; isRequired: boolean; hasDefaultValue: boolean; isUpdatedAt: boolean }>
}

const models = (
  Prisma as unknown as { dmmf: { datamodel: { models: readonly ModelMeta[] } } }
).dmmf.datamodel.models

const metaFor = (model: string) => {
  const meta = models.find((item) => item.name === model)
  if (!meta) throw new Error(`Unknown Prisma model: ${model}`)
  return meta
}

const delegateFor = (model: string) => {
  const key = `${model[0]?.toLowerCase()}${model.slice(1)}`
  const delegate = (prisma as unknown as Record<string, unknown>)[key]
  if (!delegate) throw new Error(`Prisma delegate is unavailable for ${model}`)
  return delegate as {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>
    create: (args: unknown) => Promise<Record<string, unknown>>
    update: (args: unknown) => Promise<Record<string, unknown>>
    updateMany: (args: unknown) => Promise<{ count: number }>
  }
}

const coerce = (value: unknown, type: string) => {
  if (value === "" || value === undefined) return type === "String" ? value : null
  if (type === "Int" || type === "Float" || type === "Decimal") return Number(value)
  if (type === "Boolean") return value === true || value === "true"
  if (type === "DateTime") return new Date(String(value))
  if (type === "Json" && typeof value === "string") {
    try { return JSON.parse(value) } catch { return value }
  }
  return value
}

const sanitize = (model: string, payload: unknown, editing = false, organizationId?: string) => {
  const meta = metaFor(model)
  const source = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
  const data: Record<string, unknown> = {}
  for (const field of meta.fields) {
    if (["id", "createdDate", "updatedDate", "deleted", "password"].includes(field.name)) continue
    if (field.isUpdatedAt) continue
    if (source[field.name] !== undefined) data[field.name] = coerce(source[field.name], field.type)
  }
  if (!editing && meta.fields.some((field) => field.name === "createBy") && source.createBy) data.createBy = source.createBy
  if (meta.fields.some((field) => field.name === "organizationId") && organizationId) {
    data.organizationId = organizationId
  }
  return data
}

const activeWhere = (model: string, req: AuthRequest) => {
  const meta = metaFor(model)
  const where: Record<string, unknown> = {}
  if (meta.fields.some((field) => field.name === "deleted")) where.deleted = false
  if (meta.fields.some((field) => field.name === "organizationId")) {
    where.organizationId = req.auth?.organizationId
  }
  for (const [key, value] of Object.entries(req.query)) {
    const field = meta.fields.find((item) => item.name === key)
    if (field && typeof value === "string") where[key] = coerce(value, field.type)
  }
  return where
}

const belongsToOrganization = (meta: ModelMeta, record: Record<string, unknown>, req: AuthRequest) =>
  !meta.fields.some((field) => field.name === "organizationId")
  || record.organizationId === req.auth?.organizationId

const slugify = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export const projectSlugForProperty = (property: Record<string, unknown>) =>
  slugify(
    [property.builder, property.location || property.propertyAddress || property.title]
      .filter(Boolean)
      .join("-"),
  ) || `project-${String(property.id || randomUUID()).slice(0, 8)}`

const inventoryScope = (property: Record<string, unknown>) => ({
  organizationId: String(property.organizationId || ""),
  deleted: false,
  towerName: String(property.towerName || "").trim(),
  ...(property.reraId
    ? { reraId: String(property.reraId) }
    : {
        builder: property.builder ? String(property.builder) : null,
        location: property.location ? String(property.location) : null,
      }),
})

const propertyValidationError = (
  data: Record<string, unknown>,
  existing: Record<string, unknown> = {},
) => {
  const merged = { ...existing, ...data }
  const hasTowerInventory = Boolean(
    merged.towerName || merged.totalFloors || merged.floorNumber || merged.unitNumber,
  )
  if (!hasTowerInventory) return null
  const totalFloors = Number(merged.totalFloors)
  const floorNumber = Number(merged.floorNumber)
  if (!Number.isInteger(totalFloors) || totalFloors < 1 || totalFloors > 250) {
    return "Total floors must be a whole number between 1 and 250"
  }
  if (!Number.isInteger(floorNumber) || floorNumber < 1 || floorNumber > totalFloors) {
    return `Property floor must be between 1 and ${totalFloors}`
  }
  if (!String(merged.towerName || "").trim() || !String(merged.unitNumber || "").trim()) {
    return "Tower name and unit number are required for tower inventory"
  }
  return null
}

async function propertyInventoryConflict(
  property: Record<string, unknown>,
  propertyId?: string,
) {
  const organizationId = String(property.organizationId || "")
  const towerName = String(property.towerName || "").trim()
  const totalFloors = Number(property.totalFloors)
  if (!organizationId || !towerName || !Number.isInteger(totalFloors)) return null

  const legacyConflict = await prisma.property.findFirst({
    where: {
      ...inventoryScope(property),
      ...(propertyId ? { id: { not: propertyId } } : {}),
      floorNumber: { gt: totalFloors },
    },
    select: { id: true, floorNumber: true, unitNumber: true },
  })
  if (legacyConflict) {
    return `Tower height cannot be reduced below persisted unit ${legacyConflict.unitNumber || legacyConflict.id} on floor ${legacyConflict.floorNumber}`
  }

  const project = await prisma.realEstateProject.findUnique({
    where: {
      organizationId_slug: {
        organizationId,
        slug: projectSlugForProperty(property),
      },
    },
    select: { id: true },
  })
  if (!project) return null
  const tower = await prisma.propertyTower.findUnique({
    where: { projectId_name: { projectId: project.id, name: towerName } },
    select: { id: true },
  })
  if (!tower) return null
  const highFloors = await prisma.propertyFloor.findMany({
    where: { towerId: tower.id, floorNumber: { gt: totalFloors } },
    select: { id: true, floorNumber: true },
  })
  if (!highFloors.length) return null
  const normalizedConflict = await prisma.propertyUnit.findFirst({
    where: { floorId: { in: highFloors.map((floor) => floor.id) } },
    select: { id: true, unitNumber: true, floorId: true },
  })
  if (!normalizedConflict) return null
  const floorNumber = highFloors.find((floor) => floor.id === normalizedConflict.floorId)?.floorNumber
  return `Tower height cannot be reduced below persisted unit ${normalizedConflict.unitNumber || normalizedConflict.id} on floor ${floorNumber}`
}

export async function syncPropertyInventory(property: Record<string, unknown>) {
  const organizationId = String(property.organizationId || "")
  const towerName = String(property.towerName || "").trim()
  const unitNumber = String(property.unitNumber || "").trim()
  const totalFloors = Number(property.totalFloors)
  const floorNumber = Number(property.floorNumber)
  if (!organizationId || !towerName || !unitNumber || !totalFloors || !floorNumber) return

  const projectSlug = projectSlugForProperty(property)
  const project = await prisma.realEstateProject.upsert({
    where: { organizationId_slug: { organizationId, slug: projectSlug } },
    update: {
      name: String(property.title || projectSlug),
      builder: property.builder ? String(property.builder) : null,
      location: property.location ? String(property.location) : null,
      address: property.propertyAddress ? String(property.propertyAddress) : null,
      reraId: property.reraId ? String(property.reraId) : null,
      latitude: property.latitude === null || property.latitude === undefined ? null : Number(property.latitude),
      longitude: property.longitude === null || property.longitude === undefined ? null : Number(property.longitude),
      published: Boolean(property.published),
    },
    create: {
      organizationId,
      name: String(property.title || projectSlug),
      slug: projectSlug,
      builder: property.builder ? String(property.builder) : null,
      location: property.location ? String(property.location) : null,
      address: property.propertyAddress ? String(property.propertyAddress) : null,
      reraId: property.reraId ? String(property.reraId) : null,
      latitude: property.latitude === null || property.latitude === undefined ? null : Number(property.latitude),
      longitude: property.longitude === null || property.longitude === undefined ? null : Number(property.longitude),
      published: Boolean(property.published),
    },
  })
  const tower = await prisma.propertyTower.upsert({
    where: { projectId_name: { projectId: project.id, name: towerName } },
    update: { totalFloors },
    create: { organizationId, projectId: project.id, name: towerName, totalFloors },
  })
  const staleFloors = await prisma.propertyFloor.findMany({
    where: { towerId: tower.id, floorNumber: { gt: totalFloors } },
    select: { id: true },
  })
  if (staleFloors.length) {
    await prisma.propertyFloor.deleteMany({
      where: {
        id: { in: staleFloors.map((floor) => floor.id) },
      },
    })
  }
  const floor = await prisma.propertyFloor.upsert({
    where: { towerId_floorNumber: { towerId: tower.id, floorNumber } },
    update: {},
    create: { organizationId, towerId: tower.id, floorNumber, label: `Floor ${floorNumber}` },
  })
  const existingUnit = await prisma.propertyUnit.findUnique({
    where: { floorId_unitNumber: { floorId: floor.id, unitNumber } },
  })
  const status = String(property.status || "Available")
  const unit = await prisma.propertyUnit.upsert({
    where: { floorId_unitNumber: { floorId: floor.id, unitNumber } },
    update: {
      propertyId: String(property.id),
      bedrooms: property.bedrooms === null || property.bedrooms === undefined ? null : Number(property.bedrooms),
      bathrooms: property.bathrooms === null || property.bathrooms === undefined ? null : Number(property.bathrooms),
      carpetArea: property.carpetArea === null || property.carpetArea === undefined ? null : Number(property.carpetArea),
      facing: property.facing ? String(property.facing) : null,
      listingPrice: property.listingPrice ? Number(String(property.listingPrice).replace(/[^0-9.-]/g, "")) : null,
      status,
    },
    create: {
      organizationId,
      floorId: floor.id,
      propertyId: String(property.id),
      unitNumber,
      bedrooms: property.bedrooms === null || property.bedrooms === undefined ? null : Number(property.bedrooms),
      bathrooms: property.bathrooms === null || property.bathrooms === undefined ? null : Number(property.bathrooms),
      carpetArea: property.carpetArea === null || property.carpetArea === undefined ? null : Number(property.carpetArea),
      facing: property.facing ? String(property.facing) : null,
      listingPrice: property.listingPrice ? Number(String(property.listingPrice).replace(/[^0-9.-]/g, "")) : null,
      status,
    },
  })
  if (!existingUnit || existingUnit.status !== unit.status) {
    await prisma.availabilityEvent.create({
      data: {
        organizationId,
        propertyUnitId: unit.id,
        fromStatus: existingUnit?.status,
        toStatus: unit.status,
      },
    })
  }
  await prisma.property.updateMany({
    where: inventoryScope(property),
    data: { totalFloors },
  })
}

export function createCrudRouter(model: string) {
  const router = Router()
  const delegate = delegateFor(model)
  const meta = metaFor(model)
  const hasCreatedDate = meta.fields.some((field) => field.name === "createdDate")
  const hasDeleted = meta.fields.some((field) => field.name === "deleted")
  const permissionDomain = model === "Property" ? "properties" : "leads"

  router.use(requireAuth)
  router.use(requirePermission(`${permissionDomain}.read`))
  router.use(requireWritableSubscription)

  router.get("/", async (req: AuthRequest, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1)
      const pageSize = Math.min(250, Math.max(1, Number(req.query.pageSize) || 100))
      const data = await delegate.findMany({
        where: activeWhere(model, req),
        ...(hasCreatedDate ? { orderBy: { createdDate: "desc" } } : {}),
        skip: (page - 1) * pageSize,
        take: pageSize,
      })
      res.json({ data, meta: { count: data.length, page, pageSize } })
    } catch (error) { next(error) }
  })

  router.get("/view/:id", async (req: AuthRequest, res, next) => {
    try {
      const data = await delegate.findUnique({ where: { id: req.params.id } })
      if (!data || !belongsToOrganization(meta, data, req) || (hasDeleted && data.deleted === true)) {
        res.status(404).json({ error: "Record not found" })
        return
      }
      res.json({ data })
    } catch (error) { next(error) }
  })

  router.post("/add", requirePermission(`${permissionDomain}.write`), async (req: AuthRequest, res, next) => {
    try {
      const data = sanitize(model, { ...req.body, createBy: req.auth?.userId }, false, req.auth?.organizationId)
      if (model === "Property") {
        const validationError = propertyValidationError(data)
        if (validationError) {
          res.status(400).json({ error: validationError })
          return
        }
        const inventoryConflict = await propertyInventoryConflict(data)
        if (inventoryConflict) {
          res.status(409).json({ error: inventoryConflict })
          return
        }
        data.slug = data.slug || `${slugify(data.title || data.propertyAddress || "property")}-${randomUUID().slice(0, 8)}`
        data.priceUpdatedAt = new Date()
      }
      const created = await delegate.create({ data })
      if (model === "Property") await syncPropertyInventory(created)
      res.status(201).json({ data: created, message: "Record created" })
    } catch (error) { next(error) }
  })

  router.post("/addMany", requirePermission(`${permissionDomain}.write`), async (req: AuthRequest, res, next) => {
    try {
      if (!Array.isArray(req.body)) {
        res.status(400).json({ error: "Expected an array of records" })
        return
      }
      const created = []
      for (const item of req.body.slice(0, 1_000)) {
        created.push(await delegate.create({
          data: sanitize(model, { ...item, createBy: req.auth?.userId }, false, req.auth?.organizationId),
        }))
      }
      res.status(201).json({ data: created, meta: { count: created.length } })
    } catch (error) { next(error) }
  })

  router.put("/edit/:id", requirePermission(`${permissionDomain}.write`), async (req: AuthRequest, res, next) => {
    try {
      const existing = await delegate.findUnique({ where: { id: req.params.id } })
      if (!existing || !belongsToOrganization(meta, existing, req)) {
        res.status(404).json({ error: "Record not found" })
        return
      }
      const data = sanitize(model, req.body, true, req.auth?.organizationId)
      if (model === "Property") {
        const validationError = propertyValidationError(data, existing)
        if (validationError) {
          res.status(400).json({ error: validationError })
          return
        }
        const inventoryConflict = await propertyInventoryConflict(
          { ...existing, ...data },
          String(existing.id),
        )
        if (inventoryConflict) {
          res.status(409).json({ error: inventoryConflict })
          return
        }
        if (data.listingPrice !== undefined && data.listingPrice !== existing.listingPrice) {
          data.priceUpdatedAt = new Date()
        }
      }
      const updated = await delegate.update({ where: { id: req.params.id }, data })
      if (model === "Property") await syncPropertyInventory(updated)
      res.json({ data: updated, message: "Record updated" })
    } catch (error) { next(error) }
  })

  router.delete("/delete/:id", requirePermission(`${permissionDomain}.write`), async (req: AuthRequest, res, next) => {
    try {
      const existing = await delegate.findUnique({ where: { id: req.params.id } })
      if (!existing || !belongsToOrganization(meta, existing, req)) {
        res.status(404).json({ error: "Record not found" })
        return
      }
      const data = hasDeleted
        ? await delegate.update({ where: { id: req.params.id }, data: { deleted: true } })
        : await delegate.update({ where: { id: req.params.id }, data: {} })
      res.json({ data, message: "Record deleted" })
    } catch (error) { next(error) }
  })

  router.post("/deleteMany", requirePermission(`${permissionDomain}.write`), async (req: AuthRequest, res, next) => {
    try {
      if (!Array.isArray(req.body) || !hasDeleted) {
        res.status(400).json({ error: "Bulk deletion is unavailable" })
        return
      }
      const where: Record<string, unknown> = { id: { in: req.body.map(String) } }
      if (meta.fields.some((field) => field.name === "organizationId")) {
        where.organizationId = req.auth?.organizationId
      }
      const result = await delegate.updateMany({ where, data: { deleted: true } })
      res.json({ data: result, message: "Records deleted" })
    } catch (error) { next(error) }
  })

  return router
}

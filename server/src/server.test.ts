import request from "supertest"
import { createHmac, randomUUID } from "node:crypto"
import { afterAll, describe, expect, it } from "vitest"
import prisma from "../db/prisma.js"
import app from "./server.js"
import { signToken } from "./auth.js"
import { normalizeEmail, normalizePhone, verifyHmac } from "./providers.js"
import { hasSystemPermission } from "./tenancy.js"

describe("provider and permission helpers", () => {
  it("normalizes Indian contact identifiers consistently", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210")
    expect(normalizePhone("+91-98765-43210")).toBe("+919876543210")
    expect(normalizeEmail("  Buyer@Example.COM ")).toBe("buyer@example.com")
  })

  it("verifies signed provider payloads without accepting invalid signatures", () => {
    const payload = JSON.stringify({ event: "delivered", id: "evt_1" })
    const secret = "test-webhook-secret" // pragma: allowlist secret
    const signature = createHmac("sha256", secret).update(payload).digest("hex")
    expect(verifyHmac(payload, signature, secret)).toBe(true)
    const invalidSignature = `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`
    expect(verifyHmac(payload, invalidSignature, secret)).toBe(false)
  })

  it("keeps read-only roles from receiving write permissions", () => {
    expect(hasSystemPermission("read_only", "leads.read")).toBe(true)
    expect(hasSystemPermission("read_only", "leads.write")).toBe(false)
    expect(hasSystemPermission("agent", "communications.send")).toBe(true)
    expect(hasSystemPermission("agent", "billing.manage")).toBe(false)
  })
})

describe("MooNsEstate API", () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("reports the service identity without authentication", async () => {
    const response = await request(app).get("/")
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ service: "MooNsEstate API", status: "ok" })
  })

  it("rejects protected routes without a token", async () => {
    const response = await request(app).get("/api/lead")
    expect(response.status).toBe(401)
    expect(response.body.error).toMatch(/authentication/i)
  })

  it("keeps public property discovery available without staff authentication", async () => {
    const response = await request(app).get("/api/v1/public/properties")
    expect(response.status).toBe(200)
    expect(response.body.data).toEqual(expect.any(Array))
    expect(response.body.attribution).toMatch(/OpenStreetMap/)
  })

  it("connects to the configured MySQL database", async () => {
    const response = await request(app).get("/api/health")
    expect(response.status).toBe(200)
    expect(response.body.database).toBe("connected")
  })

  it("returns real CRM analytics in a stable reporting contract", async () => {
    const user = await prisma.user.findFirst({ where: { deleted: false } })
    expect(user).toBeTruthy()
    const response = await request(app)
      .get("/api/analytics")
      .set("Authorization", `Bearer ${signToken(user!.id, user!.role)}`)

    expect(response.status).toBe(200)
    expect(response.body.data.kpis).toEqual(expect.objectContaining({
      leads: expect.any(Number),
      opportunities: expect.any(Number),
      openPipelineValue: expect.any(Number),
      conversionRate: expect.any(Number),
    }))
    expect(response.body.data.pipeline).toHaveLength(6)
    expect(response.body.data.monthlyTrend).toHaveLength(6)
    expect(response.body.data.funnel).toHaveLength(4)
  })

  it("isolates workspaces, enforces writes, and blocks free-form WhatsApp outside 24 hours", async () => {
    const suffix = randomUUID()
    const user = await prisma.user.create({
      data: {
        username: `isolation-${suffix}@example.test`,
        password: "test-only-password-hash", // pragma: allowlist secret
        role: "user",
      },
    })
    const organization = await prisma.organization.create({
      data: {
        name: `Isolation ${suffix}`,
        slug: `isolation-${suffix}`,
      },
    })
    const plan = await prisma.plan.findUniqueOrThrow({ where: { code: "starter" } })
    await Promise.all([
      prisma.membership.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: "organization_owner",
        },
      }),
      prisma.subscription.create({
        data: {
          organizationId: organization.id,
          planId: plan.id,
          provider: "razorpay",
          status: "trialing",
          trialEndsAt: new Date(Date.now() + 24 * 60 * 60_000),
        },
      }),
    ])
    const lead = await prisma.lead.create({
      data: {
        organizationId: organization.id,
        leadName: `Isolation Lead ${suffix}`,
        leadPhoneNumber: "9876543210",
        phoneE164: "+919876543210",
        leadStatus: "New",
        leadSource: "Test",
      },
    })
    const conversation = await prisma.conversation.create({
      data: {
        organizationId: organization.id,
        leadId: lead.id,
        channel: "whatsapp",
        customerWindowEndsAt: new Date(Date.now() - 60_000),
      },
    })
    const token = signToken(user.id, user.role)

    try {
      const ownWorkspace = await request(app)
        .get(`/api/v1/leads?search=${encodeURIComponent(suffix)}`)
        .set("Authorization", `Bearer ${token}`)
      expect(ownWorkspace.status).toBe(200)
      expect(ownWorkspace.body.data).toHaveLength(1)

      const existingUser = await prisma.user.findFirstOrThrow({
        where: { id: { not: user.id }, deleted: false },
      })
      const otherWorkspace = await request(app)
        .get(`/api/v1/leads?search=${encodeURIComponent(suffix)}`)
        .set("Authorization", `Bearer ${signToken(existingUser.id, existingUser.role)}`)
      expect(otherWorkspace.status).toBe(200)
      expect(otherWorkspace.body.data).toHaveLength(0)

      const outsideWindow = await request(app)
        .post(`/api/v1/conversations/${conversation.id}/messages`)
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "Free-form follow-up" })
      expect(outsideWindow.status).toBe(409)
      expect(outsideWindow.body.code).toBe("WHATSAPP_TEMPLATE_REQUIRED")

      const createdProperty = await request(app)
        .post("/api/property/add")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: `Forty Floor Regression ${suffix}`,
          builder: "Regression Builder",
          location: "Mumbai",
          propertyAddress: "Mumbai, Maharashtra",
          propertyType: "Apartment",
          listingPrice: "40000000",
          towerName: "Tower A",
          floorNumber: 14,
          totalFloors: 30,
          unitNumber: "1402",
          bedrooms: 3,
          status: "Available",
          reraId: `RERA-${suffix}`,
        })
      expect(createdProperty.status).toBe(201)
      const propertyId = createdProperty.body.data.id as string
      const updatedProperty = await request(app)
        .put(`/api/property/edit/${propertyId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ totalFloors: 40 })
      expect(updatedProperty.status).toBe(200)
      expect(updatedProperty.body.data.totalFloors).toBe(40)
      const [persistedProperty, persistedTower] = await Promise.all([
        prisma.property.findUniqueOrThrow({ where: { id: propertyId } }),
        prisma.propertyTower.findFirstOrThrow({
          where: { organizationId: organization.id, name: "Tower A" },
        }),
      ])
      expect(persistedProperty.totalFloors).toBe(40)
      expect(persistedTower.totalFloors).toBe(40)

      const initialInventory = await request(app)
        .get(`/api/v1/properties/${propertyId}/inventory`)
        .set("Authorization", `Bearer ${token}`)
      expect(initialInventory.status).toBe(200)
      expect(initialInventory.body.data.tower.totalFloors).toBe(40)
      expect(initialInventory.body.data.units).toEqual(expect.arrayContaining([
        expect.objectContaining({
          floorNumber: 14,
          unitNumber: "1402",
          isPrimary: true,
        }),
      ]))

      const createdUnit = await request(app)
        .post(`/api/v1/properties/${propertyId}/units`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          floorNumber: 14,
          unitNumber: "1403",
          bedrooms: 2,
          bathrooms: 2,
          carpetArea: 1250,
          listingPrice: 33000000,
          facing: "North-East",
          status: "Available",
        })
      expect(createdUnit.status).toBe(201)
      expect(createdUnit.body.data).toEqual(expect.objectContaining({
        floorNumber: 14,
        unitNumber: "1403",
        isPrimary: false,
      }))

      const movedUnit = await request(app)
        .patch(`/api/v1/properties/${propertyId}/units/${createdUnit.body.data.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ floorNumber: 15, unitNumber: "1501", status: "Reserved" })
      expect(movedUnit.status).toBe(200)
      expect(movedUnit.body.data).toEqual(expect.objectContaining({
        floorNumber: 15,
        unitNumber: "1501",
        status: "Reserved",
      }))

      const primaryUnit = initialInventory.body.data.units.find((unit: { isPrimary?: boolean }) => unit.isPrimary)
      const deniedPrimaryDelete = await request(app)
        .delete(`/api/v1/properties/${propertyId}/units/${primaryUnit.id}`)
        .set("Authorization", `Bearer ${token}`)
      expect(deniedPrimaryDelete.status).toBe(409)

      const removedUnit = await request(app)
        .delete(`/api/v1/properties/${propertyId}/units/${createdUnit.body.data.id}`)
        .set("Authorization", `Bearer ${token}`)
      expect(removedUnit.status).toBe(204)

      await prisma.membership.update({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: user.id,
          },
        },
        data: { role: "read_only" },
      })
      const deniedWrite = await request(app)
        .post("/api/v1/leads")
        .set("Authorization", `Bearer ${token}`)
        .send({
          leadName: "Denied lead",
          leadPhoneNumber: "9999999999",
        })
      expect(deniedWrite.status).toBe(403)
      expect(deniedWrite.body.code).toBe("PERMISSION_DENIED")
    } finally {
      const towers = await prisma.propertyTower.findMany({
        where: { organizationId: organization.id },
        select: { id: true },
      })
      const floors = await prisma.propertyFloor.findMany({
        where: { towerId: { in: towers.map((tower) => tower.id) } },
        select: { id: true },
      })
      const units = await prisma.propertyUnit.findMany({
        where: { floorId: { in: floors.map((floor) => floor.id) } },
        select: { id: true },
      })
      await prisma.availabilityEvent.deleteMany({
        where: { propertyUnitId: { in: units.map((unit) => unit.id) } },
      })
      await prisma.propertyUnit.deleteMany({ where: { organizationId: organization.id } })
      await prisma.propertyFloor.deleteMany({ where: { organizationId: organization.id } })
      await prisma.propertyTower.deleteMany({ where: { organizationId: organization.id } })
      await prisma.realEstateProject.deleteMany({ where: { organizationId: organization.id } })
      await prisma.property.deleteMany({ where: { organizationId: organization.id } })
      await prisma.conversation.deleteMany({ where: { organizationId: organization.id } })
      await prisma.lead.deleteMany({ where: { organizationId: organization.id } })
      await prisma.organization.delete({ where: { id: organization.id } })
      await prisma.user.delete({ where: { id: user.id } })
    }
  })
})

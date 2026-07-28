import request from "supertest"
import { createHmac, randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
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

      const generatedTower = await request(app)
        .post(`/api/v1/properties/${propertyId}/units/generate`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          floorFrom: 1,
          floorTo: 30,
          unitsPerFloor: 4,
          numberingPattern: "{floor}{sequence:02}",
          conflictPolicy: "skip",
          unitTemplate: {
            bedrooms: 3,
            bathrooms: 3,
            carpetArea: 1850,
            listingPrice: 40000000,
            facing: "East",
            status: "Available",
          },
        })
      expect(generatedTower.status).toBe(201)
      expect(generatedTower.body.data).toEqual(expect.objectContaining({
        requested: 120,
        generated: 119,
        skipped: 1,
        floors: 30,
      }))
      const generatedInventory = await request(app)
        .get(`/api/v1/properties/${propertyId}/inventory`)
        .set("Authorization", `Bearer ${token}`)
      expect(generatedInventory.status).toBe(200)
      expect(generatedInventory.body.data.units).toHaveLength(120)
      expect(generatedInventory.body.data.units).toEqual(expect.arrayContaining([
        expect.objectContaining({ floorNumber: 1, unitNumber: "101" }),
        expect.objectContaining({ floorNumber: 30, unitNumber: "3004" }),
      ]))

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
      await prisma.inventoryUnit.deleteMany({ where: { organizationId: organization.id } })
      await prisma.inventoryLevel.deleteMany({ where: { organizationId: organization.id } })
      await prisma.inventoryStructure.deleteMany({ where: { organizationId: organization.id } })
      await prisma.realEstateProject.deleteMany({ where: { organizationId: organization.id } })
      await prisma.property.deleteMany({ where: { organizationId: organization.id } })
      await prisma.conversation.deleteMany({ where: { organizationId: organization.id } })
      await prisma.lead.deleteMany({ where: { organizationId: organization.id } })
      await prisma.organization.delete({ where: { id: organization.id } })
      await prisma.user.delete({ where: { id: user.id } })
    }
  })
})

describe("operational inventory and agreement reporting", () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  it("generates a tower atomically, prevents double-selling, and reconciles management KPIs", async () => {
    const suffix = randomUUID()
    const user = await prisma.user.create({
      data: {
        username: `operations-${suffix}@example.test`,
        password: "test-only-password-hash",
        role: "user",
      },
    })
    const organization = await prisma.organization.create({
      data: {
        name: `Operations ${suffix}`,
        slug: `operations-${suffix}`,
        currency: "INR",
        timezone: "Asia/Kolkata",
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
    const token = signToken(user.id, user.role)

    try {
      const developerResponse = await request(app)
        .post("/api/v1/developers")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: `MooN Developments ${suffix}`,
          legalName: `MooN Developments Private Limited ${suffix}`,
          profileType: "Builder & Developer",
          reraRegistration: `DEV-RERA-${suffix}`,
          gstin: "27AAAAA0000A1Z5",
          contactPerson: "Development Partner",
          email: `developer-${suffix}@example.test`,
          status: "Active",
        })
      expect(developerResponse.status).toBe(201)

      const projectResponse = await request(app)
        .post("/api/v1/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: `Manager Tower ${suffix}`,
          developerId: developerResponse.body.data.id,
          location: "Mumbai",
          reraId: `RERA-${suffix}`,
        })
      expect(projectResponse.status).toBe(201)
      const projectId = projectResponse.body.data.id as string

      const generationRequest = {
        structure: { name: "Tower X", kind: "Tower", totalLevels: 2 },
        floorRange: { from: 1, to: 2 },
        excludedFloors: [],
        unitsPerFloor: 2,
        numbering: { pattern: "{floor}{sequence:02}", prefix: "", suffix: "" },
        unitTemplate: {
          unitType: "2 BHK",
          bedrooms: 2,
          carpetArea: 900,
          listingPrice: 10_000_000,
          baseCost: 7_000_000,
          status: "Available",
        },
        exceptions: [],
      }
      const preview = await request(app)
        .post(`/api/v1/projects/${projectId}/inventory/generation-preview`)
        .set("Authorization", `Bearer ${token}`)
        .send(generationRequest)
      expect(preview.status).toBe(200)
      expect(preview.body.data.summary).toEqual(expect.objectContaining({
        floors: 2,
        units: 4,
        conflicts: 0,
      }))
      expect(preview.body.data.units.map((unit: { unitNumber: string }) => unit.unitNumber))
        .toEqual(["101", "102", "201", "202"])

      const idempotencyKey = randomUUID()
      const commit = await request(app)
        .post(`/api/v1/projects/${projectId}/inventory/generation-commit`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          previewToken: preview.body.data.previewToken,
          idempotencyKey,
          conflictPolicy: "reject",
        })
      expect(commit.status).toBe(201)
      expect(commit.body.data.createdUnitCount).toBe(4)
      const replay = await request(app)
        .post(`/api/v1/projects/${projectId}/inventory/generation-commit`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          previewToken: preview.body.data.previewToken,
          idempotencyKey,
          conflictPolicy: "reject",
        })
      expect(replay.status).toBe(200)
      expect(replay.body.idempotentReplay).toBe(true)

      const inventory = await request(app)
        .get(`/api/v1/projects/${projectId}/inventory`)
        .set("Authorization", `Bearer ${token}`)
      expect(inventory.status).toBe(200)
      const unit = inventory.body.data.structures[0].levels[0].units[0]
      expect(unit.unitNumber).toBe("101")

      const firstDeal = await request(app)
        .post("/api/v1/deals")
        .set("Authorization", `Bearer ${token}`)
        .send({
          unitId: unit.id,
          grossPrice: 10_000_000,
          discount: 500_000,
          baseCost: 7_000_000,
          brokerage: 100_000,
          directExpenses: 200_000,
          agencyCommission: 150_000,
        })
      expect(firstDeal.status).toBe(201)
      const firstDealId = firstDeal.body.data.id as string
      const reserved = await request(app)
        .post(`/api/v1/deals/${firstDealId}/reserve`)
        .set("Authorization", `Bearer ${token}`)
      expect(reserved.status).toBe(200)

      const competingDeal = await request(app)
        .post("/api/v1/deals")
        .set("Authorization", `Bearer ${token}`)
        .send({ unitId: unit.id, grossPrice: 10_000_000 })
      const competingReservation = await request(app)
        .post(`/api/v1/deals/${competingDeal.body.data.id}/reserve`)
        .set("Authorization", `Bearer ${token}`)
      expect(competingReservation.status).toBe(409)

      const executedAt = new Date()
      const executed = await request(app)
        .post(`/api/v1/deals/${firstDealId}/execute`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          agreementNumber: `AGR-${suffix}`,
          agreementExecutedAt: executedAt.toISOString(),
        })
      expect(executed.status).toBe(200)
      expect(executed.body.data.developerGrossProfit).toBe(2_200_000)

      const payment = await request(app)
        .post(`/api/v1/deals/${firstDealId}/payments`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          amount: 1_000_000,
          reference: `PAY-${suffix}`,
          paidAt: executedAt.toISOString(),
          status: "Confirmed",
        })
      expect(payment.status).toBe(201)

      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(executedAt)
      const summary = await request(app)
        .get(`/api/v1/reports/sales-summary?from=${today}&to=${today}`)
        .set("Authorization", `Bearer ${token}`)
      expect(summary.status).toBe(200)
      expect(summary.body.data.kpis).toEqual(expect.objectContaining({
        unitsSold: 1,
        netSales: 9_500_000,
        developerGrossProfit: 2_200_000,
        agencyCommission: 150_000,
        collections: 1_000_000,
        cancellations: 0,
        averageSellingPrice: 9_500_000,
      }))
      expect(summary.body.data.deals).toHaveLength(1)
    } finally {
      const deals = await prisma.salesDeal.findMany({
        where: { organizationId: organization.id },
        select: { id: true },
      })
      await prisma.dealPayment.deleteMany({ where: { organizationId: organization.id } })
      await prisma.dealExpense.deleteMany({ where: { organizationId: organization.id } })
      await prisma.auditEvent.deleteMany({ where: { organizationId: organization.id } })
      await prisma.salesDeal.deleteMany({ where: { organizationId: organization.id } })
      await prisma.inventoryGenerationBatch.deleteMany({ where: { organizationId: organization.id } })
      await prisma.inventoryUnit.deleteMany({ where: { organizationId: organization.id } })
      await prisma.inventoryLevel.deleteMany({ where: { organizationId: organization.id } })
      await prisma.inventoryStructure.deleteMany({ where: { organizationId: organization.id } })
      await prisma.realEstateProject.deleteMany({ where: { organizationId: organization.id } })
      await prisma.developerProfile.deleteMany({ where: { organizationId: organization.id } })
      await prisma.reconciliationItem.deleteMany({ where: { organizationId: organization.id } })
      await prisma.subscription.deleteMany({ where: { organizationId: organization.id } })
      await prisma.membership.deleteMany({ where: { organizationId: organization.id } })
      await prisma.rolePermission.deleteMany({ where: { organizationId: organization.id } })
      await prisma.role.deleteMany({ where: { organizationId: organization.id } })
      await prisma.permission.deleteMany({ where: { organizationId: organization.id } })
      await prisma.organization.delete({ where: { id: organization.id } })
      await prisma.user.delete({ where: { id: user.id } })
      expect(deals).toEqual(expect.any(Array))
    }
  })
})

import prisma from "../db/prisma.js"

async function main() {
  const [
    organizations,
    memberships,
    subscriptions,
    leads,
    properties,
    inventoryProperties,
    projects,
    towers,
    floors,
    units,
    conversations,
    orphanSessions,
    invalidProperties,
  ] = await Promise.all([
    prisma.organization.count({ where: { deleted: false } }),
    prisma.membership.count({ where: { status: "active" } }),
    prisma.subscription.count(),
    prisma.lead.count({ where: { deleted: false } }),
    prisma.property.count({ where: { deleted: false } }),
    prisma.property.findMany({
      where: {
        deleted: false,
        towerName: { not: null },
        unitNumber: { not: null },
        floorNumber: { not: null },
        totalFloors: { not: null },
      },
      select: { id: true },
    }),
    prisma.realEstateProject.count(),
    prisma.propertyTower.count(),
    prisma.propertyFloor.count(),
    prisma.propertyUnit.findMany({ select: { propertyId: true } }),
    prisma.conversation.count(),
    prisma.session.count({ where: { organizationId: null, revokedAt: null } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM property_records
      WHERE deleted = false
        AND floorNumber IS NOT NULL
        AND totalFloors IS NOT NULL
        AND (floorNumber < 1 OR totalFloors < 1 OR floorNumber > totalFloors)
    `,
  ])

  const normalizedPropertyIds = new Set(
    units.map((unit) => unit.propertyId).filter((id): id is string => Boolean(id)),
  )
  const unmatchedInventoryProperties = inventoryProperties
    .map((property) => property.id)
    .filter((id) => !normalizedPropertyIds.has(id))

  const report = {
    generatedAt: new Date().toISOString(),
    status: orphanSessions === 0
      && Number(invalidProperties[0]?.count || 0) === 0
      && unmatchedInventoryProperties.length === 0
      ? "reconciled"
      : "attention_required",
    tenancy: {
      organizations,
      activeMemberships: memberships,
      subscriptions,
      activeSessionsWithoutOrganization: orphanSessions,
    },
    crm: {
      leads,
      properties,
      conversations,
    },
    inventory: {
      projects,
      towers,
      floors,
      units: units.length,
      propertiesExpectedInNormalizedInventory: inventoryProperties.length,
      unmatchedPropertyIds: unmatchedInventoryProperties,
      invalidFloorRecords: Number(invalidProperties[0]?.count || 0),
    },
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

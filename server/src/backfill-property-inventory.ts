import prisma from "../db/prisma.js"
import { syncPropertyInventory } from "./crud.js"

async function main() {
  const properties = await prisma.property.findMany({
    where: {
      deleted: false,
      towerName: { not: null },
      unitNumber: { not: null },
      floorNumber: { not: null },
      totalFloors: { not: null },
    },
    orderBy: { createdDate: "asc" },
  })
  let synchronized = 0
  for (const property of properties) {
    await syncPropertyInventory(property as unknown as Record<string, unknown>)
    synchronized += 1
  }

  const projects = await prisma.realEstateProject.findMany({
    where: { builder: { not: null } },
    orderBy: { createdDate: "asc" },
  })
  let developersMigrated = 0
  for (const project of projects) {
    const builderName = String(project.builder || "").trim()
    if (!builderName) continue
    const developer = await prisma.developerProfile.upsert({
      where: {
        organizationId_name: {
          organizationId: project.organizationId,
          name: builderName,
        },
      },
      update: {},
      create: {
        organizationId: project.organizationId,
        name: builderName,
        legalName: builderName,
        profileType: "Builder & Developer",
        status: "Active",
        notes: "Migrated from an existing project builder name; complete compliance and contact details.",
      },
    })
    if (project.developerId !== developer.id) {
      await prisma.realEstateProject.update({
        where: { id: project.id },
        data: { developerId: developer.id },
      })
    }
    developersMigrated += 1
  }

  const legacyTowers = await prisma.propertyTower.findMany({ orderBy: { createdDate: "asc" } })
  let structuresMigrated = 0
  let unitsMigrated = 0
  for (const tower of legacyTowers) {
    const structure = await prisma.inventoryStructure.upsert({
      where: { projectId_name: { projectId: tower.projectId, name: tower.name } },
      update: { totalLevels: tower.totalFloors, kind: "Tower" },
      create: {
        organizationId: tower.organizationId,
        projectId: tower.projectId,
        name: tower.name,
        kind: "Tower",
        totalLevels: tower.totalFloors,
      },
    })
    structuresMigrated += 1
    const floors = await prisma.propertyFloor.findMany({
      where: { towerId: tower.id },
      orderBy: { floorNumber: "asc" },
    })
    for (const floor of floors) {
      const level = await prisma.inventoryLevel.upsert({
        where: {
          structureId_levelNumber: {
            structureId: structure.id,
            levelNumber: floor.floorNumber,
          },
        },
        update: { label: floor.label },
        create: {
          organizationId: tower.organizationId,
          structureId: structure.id,
          levelNumber: floor.floorNumber,
          label: floor.label || `Floor ${floor.floorNumber}`,
        },
      })
      const legacyUnits = await prisma.propertyUnit.findMany({ where: { floorId: floor.id } })
      for (const unit of legacyUnits) {
        const normalizedStatus = unit.status === "Under Offer"
          ? "Hold"
          : ["Available", "Hold", "Reserved", "Booked", "Sold", "Blocked", "Cancelled"].includes(unit.status)
            ? unit.status
            : "Available"
        await prisma.inventoryUnit.upsert({
          where: {
            structureId_unitNumber: {
              structureId: structure.id,
              unitNumber: unit.unitNumber,
            },
          },
          update: {
            levelId: level.id,
            legacyPropertyId: unit.propertyId,
            unitType: unit.bedrooms === null ? null : `${unit.bedrooms} BHK`,
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
            carpetArea: unit.carpetArea,
            facing: unit.facing,
            listingPrice: unit.listingPrice,
            status: normalizedStatus,
          },
          create: {
            organizationId: tower.organizationId,
            structureId: structure.id,
            levelId: level.id,
            legacyPropertyId: unit.propertyId,
            unitNumber: unit.unitNumber,
            unitType: unit.bedrooms === null ? null : `${unit.bedrooms} BHK`,
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
            carpetArea: unit.carpetArea,
            facing: unit.facing,
            listingPrice: unit.listingPrice,
            status: normalizedStatus,
          },
        })
        unitsMigrated += 1
      }
    }
  }

  const incomplete = await prisma.property.findMany({
    where: {
      deleted: false,
      OR: [
        { towerName: null },
        { unitNumber: null },
        { floorNumber: null },
        { totalFloors: null },
      ],
    },
  })
  let reconciliationItems = 0
  for (const property of incomplete) {
    const existing = await prisma.reconciliationItem.findFirst({
      where: {
        organizationId: property.organizationId,
        channel: "inventory_migration",
        identifier: property.id,
        status: "pending",
      },
    })
    if (existing) continue
    await prisma.reconciliationItem.create({
      data: {
        organizationId: property.organizationId,
        channel: "inventory_migration",
        identifier: property.id,
        candidateLeadIds: [],
        payload: {
          title: property.title,
          towerName: property.towerName,
          totalFloors: property.totalFloors,
          floorNumber: property.floorNumber,
          unitNumber: property.unitNumber,
          reason: "Missing project, tower, floor, or unit hierarchy required by operational inventory.",
        },
      },
    })
    reconciliationItems += 1
  }

  process.stdout.write(`${JSON.stringify({
    synchronized,
    developersMigrated,
    structuresMigrated,
    unitsMigrated,
    reconciliationItems,
  }, null, 2)}\n`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

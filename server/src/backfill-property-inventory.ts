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
  process.stdout.write(`${JSON.stringify({ synchronized }, null, 2)}\n`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

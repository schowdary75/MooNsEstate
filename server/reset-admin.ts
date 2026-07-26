import "dotenv/config"
import bcrypt from "bcrypt"
import prisma from "./db/prisma.js"
import { ensureDefaultWorkspace } from "./src/tenancy.js"

async function resetAdmin() {
  const username = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const plainPassword = process.env.SEED_ADMIN_PASSWORD
  if (!username || !plainPassword || plainPassword.length < 12) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (at least 12 characters) are required")
  }

  console.log(`Configuring the local administrator ${username}...`)

  const hashedPassword = await bcrypt.hash(plainPassword, 12)

  const existingUser = await prisma.user.findUnique({ where: { username } })

  const user = existingUser
    ? await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword,
        role: "superAdmin",
        deleted: false,
      },
    })
    : await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        firstName: "Local",
        lastName: "Administrator",
        role: "superAdmin",
        deleted: false,
      },
    })
  await ensureDefaultWorkspace(user.id, user.role)
  console.log("Local administrator configured. The password was not printed.")
}

resetAdmin()
  .catch((err) => {
    console.error("Unable to configure the local administrator:", err)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())

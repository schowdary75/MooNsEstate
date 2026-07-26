import "dotenv/config"
import bcrypt from "bcrypt"
import prisma from "./db/prisma.js"

async function verifyAdmin() {
  const username = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const plainPassword = process.env.SEED_ADMIN_PASSWORD
  if (!username || !plainPassword) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required")
  }

  const user = await prisma.user.findFirst({
    where: { username, deleted: false },
  })

  if (!user) {
    throw new Error(`Administrator ${username} was not found`)
  }

  const passwordMatch = await bcrypt.compare(plainPassword, user.password)

  if (passwordMatch) {
    console.log(`Administrator ${username} is configured correctly.`)
  } else {
    throw new Error(`The configured password does not match ${username}`)
  }
}

verifyAdmin()
  .catch((error) => {
    console.error("Administrator verification failed:", error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())

import prisma from "./prisma.js"

const connectDB = async (): Promise<void> => {
  await prisma.$connect()
  console.log("Connected to MySQL through Prisma.")
}

export default connectDB

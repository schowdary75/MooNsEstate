import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import prisma from "../db/prisma.js"
import { env } from "./env.js"

const key = () => {
  if (!env.INTEGRATION_ENCRYPTION_KEY) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY is required to store organization credentials")
  }
  return createHash("sha256").update(env.INTEGRATION_ENCRYPTION_KEY).digest()
}

export const encryptConfig = (value: Record<string, unknown>) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".")
}

export const decryptConfig = <T extends Record<string, unknown>>(value?: string | null): T | null => {
  if (!value) return null
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".")
  if (!ivRaw || !tagRaw || !encryptedRaw) return null
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"))
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ])
  return JSON.parse(decrypted.toString("utf8")) as T
}

export async function integrationConfig<T extends Record<string, unknown>>(
  organizationId: string,
  provider: string,
): Promise<T | null> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
  })
  return decryptConfig<T>(connection?.encryptedConfig)
}

export async function saveIntegrationConfig(
  organizationId: string,
  provider: string,
  config: Record<string, unknown>,
  externalAccountId?: string,
) {
  return prisma.integrationConnection.upsert({
    where: { organizationId_provider: { organizationId, provider } },
    update: {
      encryptedConfig: encryptConfig(config),
      externalAccountId,
      status: "configured",
      lastError: null,
    },
    create: {
      organizationId,
      provider,
      encryptedConfig: encryptConfig(config),
      externalAccountId,
      status: "configured",
    },
    select: {
      id: true,
      provider: true,
      status: true,
      externalAccountId: true,
      expiresAt: true,
      lastSyncAt: true,
      lastError: true,
      updatedDate: true,
    },
  })
}


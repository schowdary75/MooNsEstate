import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { env } from "./env.js"
import { integrationConfig } from "./integration-config.js"

type StorageConfig = {
  endpoint?: string
  region?: string
  bucket?: string
  accessKeyId?: string
  secretAccessKey?: string
}

const storageConfigFor = async (organizationId: string): Promise<Required<StorageConfig> | null> => {
  const stored = await integrationConfig<StorageConfig>(organizationId, "storage")
  const config = {
    endpoint: stored?.endpoint || env.S3_ENDPOINT || "",
    region: stored?.region || env.S3_REGION,
    bucket: stored?.bucket || env.S3_BUCKET || "",
    accessKeyId: stored?.accessKeyId || env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: stored?.secretAccessKey || env.S3_SECRET_ACCESS_KEY || "",
  }
  return config.bucket && config.accessKeyId && config.secretAccessKey ? config : null
}

const client = (config: Required<StorageConfig>) => new S3Client({
  region: config.region,
  ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
  ...(config.accessKeyId && config.secretAccessKey
    ? {
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      }
    : {}),
})

export const storageConfigured = async (organizationId: string) =>
  Boolean(await storageConfigFor(organizationId))

export async function putPrivateObject(
  organizationId: string,
  key: string,
  body: Uint8Array,
  contentType?: string,
) {
  const config = await storageConfigFor(organizationId)
  if (!config) throw new Error("S3-compatible storage is not configured")
  await client(config).send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
  }))
  return key
}

export async function privateObjectUrl(organizationId: string, key: string, expiresIn = 900) {
  const config = await storageConfigFor(organizationId)
  if (!config) throw new Error("S3-compatible storage is not configured")
  return getSignedUrl(
    client(config),
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { expiresIn },
  )
}

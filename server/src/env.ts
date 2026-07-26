import "dotenv/config"
import { z } from "zod"

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(5001),
  CORS_ORIGIN: z.string().default("http://127.0.0.1:3000,http://localhost:3000"),
  APP_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SESSION_COOKIE_NAME: z.string().default("moon_session"),
  SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  SESSION_ROTATE_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  ALLOW_DEVELOPMENT_PROVIDER_PREVIEWS: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  INTEGRATION_ENCRYPTION_KEY: z.string().min(32).optional().or(z.literal("")),
  REDIS_URL: z.string().optional().or(z.literal("")),
  GEOAPIFY_API_KEY: z.string().optional().or(z.literal("")),
  META_APP_ID: z.string().optional().or(z.literal("")),
  META_APP_SECRET: z.string().optional().or(z.literal("")),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional().or(z.literal("")),
  META_ORGANIZATION_ID: z.string().uuid().optional().or(z.literal("")),
  META_ACCESS_TOKEN: z.string().optional().or(z.literal("")),
  META_PAGE_ID: z.string().optional().or(z.literal("")),
  META_AD_ACCOUNT_ID: z.string().optional().or(z.literal("")),
  META_PHONE_NUMBER_ID: z.string().optional().or(z.literal("")),
  META_WABA_ID: z.string().optional().or(z.literal("")),
  META_DATASET_ID: z.string().optional().or(z.literal("")),
  META_GRAPH_VERSION: z.string().default("v23.0"),
  RESEND_API_KEY: z.string().optional().or(z.literal("")),
  RESEND_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
  RESEND_FROM_EMAIL: z.string().optional().or(z.literal("")),
  EXOTEL_ACCOUNT_SID: z.string().optional().or(z.literal("")),
  EXOTEL_API_KEY: z.string().optional().or(z.literal("")),
  EXOTEL_API_TOKEN: z.string().optional().or(z.literal("")),
  EXOTEL_CALLER_ID: z.string().optional().or(z.literal("")),
  EXOTEL_CALLBACK_TOKEN: z.string().min(24).optional().or(z.literal("")),
  EXOTEL_REGION: z.enum(["mumbai", "singapore"]).default("mumbai"),
  SARVAM_API_KEY: z.string().optional().or(z.literal("")),
  SARVAM_CALLBACK_TOKEN: z.string().optional().or(z.literal("")),
  RAZORPAY_KEY_ID: z.string().optional().or(z.literal("")),
  RAZORPAY_KEY_SECRET: z.string().optional().or(z.literal("")),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
  STRIPE_SECRET_KEY: z.string().optional().or(z.literal("")),
  STRIPE_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
  S3_ENDPOINT: z.string().optional().or(z.literal("")),
  S3_REGION: z.string().default("ap-south-1"),
  S3_BUCKET: z.string().optional().or(z.literal("")),
  S3_ACCESS_KEY_ID: z.string().optional().or(z.literal("")),
  S3_SECRET_ACCESS_KEY: z.string().optional().or(z.literal("")),
  SEED_ADMIN_EMAIL: z.string().email().optional().or(z.literal("")),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional().or(z.literal("")),
}).superRefine((values, context) => {
  if (values.NODE_ENV !== "production") return
  if (!values.INTEGRATION_ENCRYPTION_KEY) {
    context.addIssue({
      code: "custom",
      path: ["INTEGRATION_ENCRYPTION_KEY"],
      message: "Production requires an integration encryption key",
    })
  }
  if (!values.REDIS_URL) {
    context.addIssue({
      code: "custom",
      path: ["REDIS_URL"],
      message: "Production requires Redis for durable provider jobs",
    })
  }
})

export const env = schema.parse(process.env)
export const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)

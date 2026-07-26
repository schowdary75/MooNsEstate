import { Queue, Worker, type Job } from "bullmq"
import { randomUUID } from "node:crypto"
import { Redis } from "ioredis"
import { env } from "./env.js"
import { hydrateMetaLead } from "./meta-service.js"
import prisma from "../db/prisma.js"
import { transcribeCall } from "./transcription.js"

export type JobName = "transcribe-call" | "meta-lead-hydrate"

type JobPayload = {
  "transcribe-call": { callId: string }
  "meta-lead-hydrate": {
    organizationId: string
    metaLeadId: string
    webhookPayload: Record<string, unknown>
    externalEventId: string
  }
}

const connection = env.REDIS_URL
  ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  : null

const queue = connection
  ? new Queue<JobPayload[JobName], unknown, JobName>("moon-integrations", { connection })
  : null

const processJob = async (job: Pick<Job, "name" | "data">) => {
  if (job.name === "transcribe-call") {
    return transcribeCall((job.data as JobPayload["transcribe-call"]).callId)
  }
  if (job.name === "meta-lead-hydrate") {
    const data = job.data as JobPayload["meta-lead-hydrate"]
    try {
      await hydrateMetaLead(data.organizationId, data.metaLeadId, data.webhookPayload)
      return prisma.providerWebhookEvent.update({
        where: {
          provider_externalEventId: {
            provider: "meta",
            externalEventId: data.externalEventId,
          },
        },
        data: { status: "processed", processedAt: new Date(), errorMessage: null },
      })
    } catch (error) {
      await prisma.providerWebhookEvent.update({
        where: {
          provider_externalEventId: {
            provider: "meta",
            externalEventId: data.externalEventId,
          },
        },
        data: {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Meta hydration failed",
        },
      })
      throw error
    }
  }
  throw new Error(`Unsupported job: ${job.name}`)
}

export async function enqueueJob<Name extends JobName>(name: Name, data: JobPayload[Name]) {
  if (!queue) {
    if (env.NODE_ENV === "production") {
      throw new Error("Redis is required for durable provider jobs in production")
    }
    setTimeout(() => {
      void processJob({ name, data }).catch((error) => {
        console.error(`[jobs] ${name} failed`, error)
      })
    }, 0)
    return { id: `inline:${randomUUID()}`, mode: "inline" as const }
  }
  const job = await queue.add(name, data, {
    attempts: 5,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: 1_000,
    removeOnFail: 5_000,
  })
  return { id: String(job.id), mode: "redis" as const }
}

export function startJobWorker() {
  if (!connection) {
    if (env.NODE_ENV === "production") {
      throw new Error("Redis is required for the provider worker in production")
    }
    return null
  }
  const worker = new Worker("moon-integrations", processJob, {
    connection,
    concurrency: 5,
  })
  worker.on("failed", (job, error) => {
    console.error(`[jobs] ${job?.name || "unknown"} failed`, error)
  })
  return worker
}

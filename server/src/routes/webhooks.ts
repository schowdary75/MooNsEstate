import { createHmac, timingSafeEqual } from "node:crypto"
import express, { Router, type Request } from "express"
import Stripe from "stripe"
import { Webhook } from "svix"
import prisma from "../../db/prisma.js"
import { env } from "../env.js"
import { decryptConfig, integrationConfig } from "../integration-config.js"
import { enqueueJob } from "../jobs.js"
import { metaConnectionForPage } from "../meta-service.js"
import { normalizeEmail, normalizePhone, verifyHmac } from "../providers.js"
import { emitToOrganization } from "../realtime.js"

type MetaConfig = {
  accessToken?: string
  phoneNumberId?: string
  wabaId?: string
  pageId?: string
}

type ResendConfig = {
  apiKey?: string
  fromEmail?: string
  inboundDomain?: string
  webhookSecret?: string
}

const rawJson = express.raw({ type: "application/json", limit: "5mb" })
const formBody = express.urlencoded({ extended: false, limit: "1mb" })

const jsonBody = (req: Request) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "")
  return { raw, data: JSON.parse(raw) as Record<string, unknown> }
}

const eventRecord = async (
  provider: string,
  externalEventId: string,
  payload: Record<string, unknown>,
  organizationId?: string | null,
  eventType?: string,
) => prisma.providerWebhookEvent.upsert({
  where: { provider_externalEventId: { provider, externalEventId } },
  update: {},
  create: {
    organizationId,
    provider,
    externalEventId,
    eventType,
    payload: JSON.parse(JSON.stringify(payload)),
  },
})

const metaConnectionForPhone = async (phoneNumberId: string) => {
  const connections = await prisma.integrationConnection.findMany({
    where: { provider: "meta", status: "configured" },
  })
  for (const connection of connections) {
    const config = decryptConfig<MetaConfig>(connection.encryptedConfig)
    if (config?.phoneNumberId === phoneNumberId || config?.wabaId === phoneNumberId) {
      return { organizationId: connection.organizationId, config }
    }
  }
  return null
}

const resendConnectionForRecipient = async (recipient: string) => {
  const normalized = normalizeEmail(recipient)
  const domain = normalized.split("@")[1] || ""
  const connections = await prisma.integrationConnection.findMany({
    where: { provider: "resend", status: "configured" },
  })
  for (const connection of connections) {
    const config = decryptConfig<ResendConfig>(connection.encryptedConfig)
    if (
      normalizeEmail(config?.fromEmail) === normalized
      || String(config?.inboundDomain || "").toLowerCase() === domain
    ) {
      return { organizationId: connection.organizationId, config }
    }
  }
  return null
}

const inboundWhatsapp = async (
  organizationId: string,
  value: Record<string, unknown>,
  message: Record<string, unknown>,
) => {
  const from = normalizePhone(message.from)
  const providerMessageId = String(message.id || "")
  if (!from || !providerMessageId) return
  const candidates = await prisma.lead.findMany({
    where: { organizationId, phoneE164: from, deleted: false },
    take: 3,
  })
  if (candidates.length > 1) {
    await prisma.reconciliationItem.create({
      data: {
        organizationId,
        channel: "whatsapp",
        identifier: from,
        candidateLeadIds: candidates.map((candidate) => candidate.id),
        payload: JSON.parse(JSON.stringify({ value, message })),
      },
    })
    emitToOrganization(organizationId, "reconciliation.created", { channel: "whatsapp", identifier: from })
    return
  }
  let lead = candidates[0] || null
  if (!lead) {
    const contacts = Array.isArray(value.contacts) ? value.contacts as Array<Record<string, unknown>> : []
    const profile = contacts[0]?.profile && typeof contacts[0].profile === "object"
      ? contacts[0].profile as Record<string, unknown>
      : {}
    const assigned = await prisma.membership.findFirst({
      where: {
        organizationId,
        status: "active",
        role: { in: ["agent", "sales_manager", "organization_owner", "organization_admin"] },
      },
      orderBy: { createdDate: "asc" },
    })
    lead = await prisma.lead.create({
      data: {
        organizationId,
        leadName: String(profile.name || "WhatsApp lead"),
        leadPhoneNumber: from,
        phoneE164: from,
        leadStatus: "New",
        leadSource: "WhatsApp",
        priority: "High",
        assignedTo: assigned?.userId,
        firstResponseDueAt: new Date(Date.now() + 5 * 60_000),
      },
    })
  }
  let conversation = await prisma.conversation.findFirst({
    where: { organizationId, leadId: lead.id, channel: "whatsapp" },
  })
  const sentAt = message.timestamp
    ? new Date(Number(message.timestamp) * 1_000)
    : new Date()
  const customerWindowEndsAt = new Date(sentAt.getTime() + 24 * 60 * 60_000)
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        organizationId,
        leadId: lead.id,
        channel: "whatsapp",
        assignedTo: lead.assignedTo,
        lastMessageAt: sentAt,
        customerWindowEndsAt,
        unreadCount: 0,
      },
    })
  }
  const type = String(message.type || "unknown")
  const body = message.text && typeof message.text === "object"
    ? String((message.text as Record<string, unknown>).body || "")
    : message.button && typeof message.button === "object"
      ? String((message.button as Record<string, unknown>).text || "")
      : ""
  await prisma.message.upsert({
    where: {
      organizationId_providerMessageId: {
        organizationId,
        providerMessageId,
      },
    },
    update: {},
    create: {
      organizationId,
      conversationId: conversation.id,
      providerMessageId,
      direction: "inbound",
      type,
      sender: from,
      recipient: String((value.metadata as Record<string, unknown> | undefined)?.display_phone_number || ""),
      text: body,
      status: "delivered",
      deliveredAt: sentAt,
      metadata: JSON.parse(JSON.stringify(message)),
    },
  })
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: sentAt,
      customerWindowEndsAt,
      unreadCount: { increment: 1 },
      status: "open",
    },
  })
  emitToOrganization(organizationId, "conversation.message", {
    conversationId: conversation.id,
    leadId: lead.id,
    channel: "whatsapp",
    providerMessageId,
  })
  const referral = message.referral && typeof message.referral === "object"
    ? message.referral as Record<string, unknown>
    : null
  if (referral) {
    await prisma.attributionTouch.create({
      data: {
        organizationId,
        leadId: lead.id,
        source: "click_to_whatsapp",
        adExternalId: referral.source_id ? String(referral.source_id) : null,
        referral: JSON.parse(JSON.stringify(referral)),
        occurredAt: sentAt,
      },
    })
  }
  await prisma.activityEvent.create({
    data: {
      organizationId,
      leadId: lead.id,
      type: "whatsapp.received",
      title: "WhatsApp message received",
      metadata: { conversationId: conversation.id, providerMessageId },
      occurredAt: sentAt,
    },
  })
}

const whatsappStatus = async (
  organizationId: string,
  status: Record<string, unknown>,
) => {
  const providerMessageId = String(status.id || "")
  if (!providerMessageId) return
  const message = await prisma.message.findUnique({
    where: {
      organizationId_providerMessageId: {
        organizationId,
        providerMessageId,
      },
    },
  })
  if (!message) return
  const name = String(status.status || "unknown")
  const occurredAt = status.timestamp
    ? new Date(Number(status.timestamp) * 1_000)
    : new Date()
  await prisma.message.update({
    where: { id: message.id },
    data: {
      status: name,
      ...(name === "sent" ? { sentAt: occurredAt } : {}),
      ...(name === "delivered" ? { deliveredAt: occurredAt } : {}),
      ...(name === "read" ? { readAt: occurredAt } : {}),
      ...(name === "failed" ? {
        failedAt: occurredAt,
        errorMessage: JSON.stringify(status.errors || "WhatsApp delivery failed"),
      } : {}),
    },
  })
  await prisma.deliveryEvent.upsert({
    where: {
      organizationId_providerEventId: {
        organizationId,
        providerEventId: `${providerMessageId}:${name}:${occurredAt.getTime()}`,
      },
    },
    update: {},
    create: {
      organizationId,
      messageId: message.id,
      providerEventId: `${providerMessageId}:${name}:${occurredAt.getTime()}`,
      status: name,
      payload: JSON.parse(JSON.stringify(status)),
      occurredAt,
    },
  })
}

export const webhooksRouter = Router()

webhooksRouter.get("/meta", (req, res) => {
  const mode = String(req.query["hub.mode"] || "")
  const token = String(req.query["hub.verify_token"] || "")
  const challenge = String(req.query["hub.challenge"] || "")
  if (mode === "subscribe" && env.META_WEBHOOK_VERIFY_TOKEN && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    res.type("text/plain").send(challenge)
    return
  }
  res.sendStatus(403)
})

webhooksRouter.post("/meta", rawJson, async (req, res) => {
  try {
    if (!env.META_APP_SECRET) {
      res.status(503).json({ error: "Meta webhook secret is not configured" })
      return
    }
    const { raw, data } = jsonBody(req)
    if (!verifyHmac(raw, req.header("x-hub-signature-256") || undefined, env.META_APP_SECRET)) {
      res.status(401).json({ error: "Invalid Meta webhook signature" })
      return
    }
    const entries = Array.isArray(data.entry) ? data.entry as Array<Record<string, unknown>> : []
    const pending: Array<Promise<unknown>> = []
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes as Array<Record<string, unknown>> : []
      for (const change of changes) {
        const field = String(change.field || "")
        const value = change.value && typeof change.value === "object"
          ? change.value as Record<string, unknown>
          : {}
        if (field === "leadgen") {
          const metaLeadId = String(value.leadgen_id || "")
          const pageId = String(value.page_id || entry.id || "")
          if (!metaLeadId || !pageId) continue
          const connection = await metaConnectionForPage(pageId)
          const externalEventId = `leadgen:${pageId}:${metaLeadId}`
          await eventRecord("meta", externalEventId, value, connection?.organizationId, "leadgen")
          if (connection) {
            await enqueueJob("meta-lead-hydrate", {
              organizationId: connection.organizationId,
              metaLeadId,
              webhookPayload: value,
              externalEventId,
            })
            await prisma.providerWebhookEvent.update({
              where: { provider_externalEventId: { provider: "meta", externalEventId } },
              data: { status: "queued" },
            })
          }
        }
        if (field === "messages") {
          const metadata = value.metadata && typeof value.metadata === "object"
            ? value.metadata as Record<string, unknown>
            : {}
          const phoneNumberId = String(metadata.phone_number_id || entry.id || "")
          const connection = await metaConnectionForPhone(phoneNumberId)
          if (!connection) continue
          const messages = Array.isArray(value.messages) ? value.messages as Array<Record<string, unknown>> : []
          const statuses = Array.isArray(value.statuses) ? value.statuses as Array<Record<string, unknown>> : []
          for (const message of messages) pending.push(inboundWhatsapp(connection.organizationId, value, message))
          for (const status of statuses) pending.push(whatsappStatus(connection.organizationId, status))
        }
      }
    }
    res.sendStatus(200)
    void Promise.allSettled(pending)
  } catch (error) {
    console.error("[webhooks] Meta webhook failed", error)
    res.sendStatus(400)
  }
})

webhooksRouter.post("/resend", rawJson, async (req, res) => {
  try {
    const { raw } = jsonBody(req)
    const unverified = JSON.parse(raw) as {
      data?: { to?: string | string[]; from?: string }
    }
    const addresses = [
      ...(Array.isArray(unverified.data?.to) ? unverified.data.to : [unverified.data?.to]),
      unverified.data?.from,
    ].filter((address): address is string => Boolean(address))
    let hintedConnection: Awaited<ReturnType<typeof resendConnectionForRecipient>> = null
    for (const address of addresses) {
      hintedConnection = await resendConnectionForRecipient(address)
      if (hintedConnection) break
    }
    const webhookSecret = hintedConnection?.config?.webhookSecret || env.RESEND_WEBHOOK_SECRET
    if (!webhookSecret) {
      res.status(503).json({ error: "Resend webhook secret is not configured" })
      return
    }
    const payload = new Webhook(webhookSecret).verify(raw, {
      "svix-id": req.header("svix-id") || "",
      "svix-timestamp": req.header("svix-timestamp") || "",
      "svix-signature": req.header("svix-signature") || "",
    }) as Record<string, unknown>
    const externalEventId = req.header("svix-id") || crypto.randomUUID()
    const eventType = String(payload.type || "")
    const data = payload.data && typeof payload.data === "object"
      ? payload.data as Record<string, unknown>
      : {}
    const emailId = String(data.email_id || "")
    if (eventType === "email.received") {
      const recipients = Array.isArray(data.to) ? data.to : [data.to]
      const recipient = normalizeEmail(recipients.find(Boolean))
      const connection = await resendConnectionForRecipient(recipient)
      await eventRecord("resend", externalEventId, payload, connection?.organizationId, eventType)
      if (!connection) {
        await prisma.providerWebhookEvent.update({
          where: { provider_externalEventId: { provider: "resend", externalEventId } },
          data: { status: "reconciliation_required", errorMessage: "Inbound recipient is not mapped to a workspace" },
        })
        res.sendStatus(202)
        return
      }
      let received = data
      if (!data.text && !data.html && connection.config?.apiKey && emailId) {
        const contentResponse = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
          headers: { Authorization: `Bearer ${connection.config.apiKey}` },
        })
        if (contentResponse.ok) {
          received = {
            ...data,
            ...await contentResponse.json() as Record<string, unknown>,
          }
        }
      }
      const senderRaw = String(received.from || data.from || "")
      const senderMatch = senderRaw.match(/<([^>]+)>/)
      const sender = normalizeEmail(senderMatch?.[1] || senderRaw)
      const candidates = await prisma.lead.findMany({
        where: { organizationId: connection.organizationId, leadEmail: sender, deleted: false },
        take: 3,
      })
      if (candidates.length > 1) {
        await prisma.reconciliationItem.create({
          data: {
            organizationId: connection.organizationId,
            channel: "email",
            identifier: sender,
            candidateLeadIds: candidates.map((candidate) => candidate.id),
            payload: JSON.parse(JSON.stringify(received)),
          },
        })
        await prisma.providerWebhookEvent.update({
          where: { provider_externalEventId: { provider: "resend", externalEventId } },
          data: { status: "reconciliation_required" },
        })
        emitToOrganization(connection.organizationId, "reconciliation.created", { channel: "email", identifier: sender })
        res.sendStatus(202)
        return
      }
      const lead = candidates[0] || await prisma.lead.create({
        data: {
          organizationId: connection.organizationId,
          leadName: senderRaw.split("<")[0]?.trim() || sender,
          leadEmail: sender,
          leadSource: "Inbound Email",
          leadStatus: "New",
          priority: "High",
          firstResponseDueAt: new Date(Date.now() + 5 * 60_000),
        },
      })
      let conversation = await prisma.conversation.findFirst({
        where: { organizationId: connection.organizationId, leadId: lead.id, channel: "email" },
      })
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            organizationId: connection.organizationId,
            leadId: lead.id,
            channel: "email",
            assignedTo: lead.assignedTo,
            subject: String(received.subject || "Inbound email"),
          },
        })
      }
      const inbound = await prisma.message.upsert({
        where: {
          organizationId_providerMessageId: {
            organizationId: connection.organizationId,
            providerMessageId: emailId || externalEventId,
          },
        },
        update: {},
        create: {
          organizationId: connection.organizationId,
          conversationId: conversation.id,
          providerMessageId: emailId || externalEventId,
          direction: "inbound",
          type: received.html ? "html" : "text",
          sender,
          recipient,
          text: String(received.text || ""),
          html: String(received.html || ""),
          status: "delivered",
          deliveredAt: new Date(),
          metadata: JSON.parse(JSON.stringify(received)),
        },
      })
      const headers = received.headers && typeof received.headers === "object"
        ? received.headers
        : {}
      await Promise.all([
        prisma.emailThread.upsert({
          where: { conversationId: conversation.id },
          update: { references: JSON.parse(JSON.stringify(headers)) },
          create: {
            organizationId: connection.organizationId,
            conversationId: conversation.id,
            rootMessageId: inbound.id,
            references: JSON.parse(JSON.stringify(headers)),
          },
        }),
        prisma.conversation.update({
          where: { id: conversation.id },
          data: { unreadCount: { increment: 1 }, lastMessageAt: new Date(), status: "open" },
        }),
        prisma.activityEvent.create({
          data: {
            organizationId: connection.organizationId,
            leadId: lead.id,
            type: "email.received",
            title: "Inbound email received",
            metadata: { conversationId: conversation.id, messageId: inbound.id },
          },
        }),
        prisma.providerWebhookEvent.update({
          where: { provider_externalEventId: { provider: "resend", externalEventId } },
          data: { status: "processed", processedAt: new Date() },
        }),
      ])
      emitToOrganization(connection.organizationId, "conversation.message", {
        conversationId: conversation.id,
        leadId: lead.id,
        channel: "email",
        messageId: inbound.id,
      })
      res.sendStatus(200)
      return
    }
    const message = emailId
      ? await prisma.message.findFirst({ where: { providerMessageId: emailId } })
      : null
    await eventRecord("resend", externalEventId, payload, message?.organizationId, eventType)
    if (message) {
      const status = eventType.replace("email.", "")
      const occurredAt = payload.created_at ? new Date(String(payload.created_at)) : new Date()
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status,
          ...(status === "delivered" ? { deliveredAt: occurredAt } : {}),
          ...(status === "opened" ? { readAt: occurredAt } : {}),
          ...(["bounced", "failed", "complained", "suppressed"].includes(status)
            ? { failedAt: occurredAt, errorMessage: JSON.stringify(data.bounce || data) }
            : {}),
        },
      })
      if (["bounced", "complained", "suppressed"].includes(status) && message.recipient) {
        await prisma.suppressionEntry.upsert({
          where: {
            organizationId_channel_address: {
              organizationId: message.organizationId,
              channel: "email",
              address: normalizeEmail(message.recipient),
            },
          },
          update: { reason: status, provider: "resend" },
          create: {
            organizationId: message.organizationId,
            channel: "email",
            address: normalizeEmail(message.recipient),
            reason: status,
            provider: "resend",
          },
        })
      }
    }
    await prisma.providerWebhookEvent.update({
      where: { provider_externalEventId: { provider: "resend", externalEventId } },
      data: { status: "processed", processedAt: new Date() },
    })
    res.sendStatus(200)
  } catch (error) {
    console.error("[webhooks] Resend webhook failed", error)
    res.sendStatus(400)
  }
})

webhooksRouter.post("/exotel", formBody, async (req, res) => {
  try {
    const payload = req.body as Record<string, unknown>
    let custom: Record<string, unknown> = {}
    try { custom = JSON.parse(String(payload.CustomField || "{}")) as Record<string, unknown> } catch {}
    const callId = String(custom.callId || "")
    const providerCallId = String(payload.CallSid || payload.Sid || "")
    const call = callId
      ? await prisma.callRecord.findUnique({ where: { id: callId } })
      : providerCallId
        ? await prisma.callRecord.findFirst({ where: { providerCallId } })
        : null
    if (!call) {
      res.sendStatus(200)
      return
    }
    const exotelConfig = await integrationConfig<{ callbackToken?: string }>(call.organizationId, "exotel")
    const expectedToken = exotelConfig?.callbackToken || env.EXOTEL_CALLBACK_TOKEN
    if (!expectedToken || String(req.query.token || "") !== expectedToken) {
      res.sendStatus(401)
      return
    }
    const eventType = String(payload.EventType || payload.Status || "callback")
    const eventTime = String(payload.EventTime || payload.DateUpdated || Date.now())
    const externalEventId = `${providerCallId}:${eventType}:${eventTime}`
    await eventRecord("exotel", externalEventId, payload, call.organizationId, eventType)
    const status = String(payload.Status || payload.DialCallStatus || eventType).toLowerCase()
    const duration = Number(payload.ConversationDuration || payload.Duration || payload.DialCallDuration || 0)
    const recordingUrl = String(payload.RecordingUrl || payload.recording_url || "")
    await prisma.callRecord.update({
      where: { id: call.id },
      data: {
        providerCallId: providerCallId || call.providerCallId,
        status,
        ...(status === "ringing" ? { startedAt: new Date() } : {}),
        ...(eventType.toLowerCase() === "answered" ? { answeredAt: new Date() } : {}),
        ...(["completed", "failed", "busy", "no-answer"].includes(status)
          ? { endedAt: new Date(), durationSeconds: duration }
          : {}),
        metadata: JSON.parse(JSON.stringify(payload)),
      },
    })
    if (recordingUrl && call.consentedToRecording) {
      const organization = await prisma.organization.findUnique({ where: { id: call.organizationId } })
      const retentionUntil = new Date()
      retentionUntil.setDate(retentionUntil.getDate() + (organization?.recordingRetentionDays || 180))
      await prisma.callRecording.upsert({
        where: { callId: call.id },
        update: { providerUrl: recordingUrl, durationSeconds: duration, retentionUntil },
        create: {
          organizationId: call.organizationId,
          callId: call.id,
          providerUrl: recordingUrl,
          durationSeconds: duration,
          retentionUntil,
        },
      })
      await prisma.transcript.upsert({
        where: { callId: call.id },
        update: { status: "queued", errorMessage: null },
        create: { organizationId: call.organizationId, callId: call.id },
      })
      await enqueueJob("transcribe-call", { callId: call.id })
    }
    await prisma.providerWebhookEvent.update({
      where: { provider_externalEventId: { provider: "exotel", externalEventId } },
      data: { status: "processed", processedAt: new Date() },
    })
    res.sendStatus(200)
  } catch (error) {
    console.error("[webhooks] Exotel webhook failed", error)
    res.sendStatus(400)
  }
})

webhooksRouter.post("/sarvam", rawJson, async (req, res) => {
  try {
    const { data } = jsonBody(req)
    const jobId = String(data.job_id || "")
    const transcript = await prisma.transcript.findFirst({ where: { providerJobId: jobId } })
    if (!transcript) {
      res.sendStatus(404)
      return
    }
    const stored = await integrationConfig<{ callbackToken?: string }>(transcript.organizationId, "sarvam")
    const callbackToken = stored?.callbackToken || env.SARVAM_CALLBACK_TOKEN
    if (!callbackToken || req.header("x-sarvam-job-callback-token") !== callbackToken) {
      res.sendStatus(401)
      return
    }
    if (String(data.job_state || "") === "Failed") {
      await prisma.transcript.update({
        where: { id: transcript.id },
        data: { status: "failed", errorMessage: String(data.error_message || "Sarvam job failed") },
      })
    }
    res.sendStatus(200)
  } catch {
    res.sendStatus(400)
  }
})

webhooksRouter.post("/razorpay", rawJson, async (req, res) => {
  try {
    const { raw, data } = jsonBody(req)
    const eventType = String(data.event || "")
    const payload = data.payload && typeof data.payload === "object"
      ? data.payload as Record<string, unknown>
      : {}
    const subscriptionWrapper = payload.subscription && typeof payload.subscription === "object"
      ? payload.subscription as Record<string, unknown>
      : {}
    const entity = subscriptionWrapper.entity && typeof subscriptionWrapper.entity === "object"
      ? subscriptionWrapper.entity as Record<string, unknown>
      : {}
    const providerSubscriptionId = String(entity.id || "")
    const notes = entity.notes && typeof entity.notes === "object"
      ? entity.notes as Record<string, unknown>
      : {}
    const organizationId = String(notes.organizationId || "")
    const secretCandidates: string[] = []
    if (organizationId) {
      const stored = await integrationConfig<{ webhookSecret?: string }>(organizationId, "razorpay")
      if (stored?.webhookSecret) secretCandidates.push(stored.webhookSecret)
    } else {
      const connections = await prisma.integrationConnection.findMany({
        where: { provider: "razorpay", status: "configured" },
      })
      for (const connection of connections) {
        const config = decryptConfig<{ webhookSecret?: string }>(connection.encryptedConfig)
        if (config?.webhookSecret) secretCandidates.push(config.webhookSecret)
      }
    }
    if (env.RAZORPAY_WEBHOOK_SECRET) secretCandidates.push(env.RAZORPAY_WEBHOOK_SECRET)
    if (!secretCandidates.length) {
      res.sendStatus(503)
      return
    }
    const received = req.header("x-razorpay-signature") || ""
    const valid = secretCandidates.some((secret) => {
      const expected = createHmac("sha256", secret).update(raw).digest("hex")
      return received.length === expected.length
        && timingSafeEqual(Buffer.from(received), Buffer.from(expected))
    })
    if (!valid) {
      res.sendStatus(401)
      return
    }
    const providerEventId = req.header("x-razorpay-event-id")
      || `${eventType}:${providerSubscriptionId}:${String(entity.updated_at || entity.created_at || Date.now())}`
    await prisma.billingEvent.upsert({
      where: { provider_providerEventId: { provider: "razorpay", providerEventId } },
      update: {},
      create: {
        organizationId: organizationId || null,
        provider: "razorpay",
        providerEventId,
        eventType,
        payload: JSON.parse(JSON.stringify(data)),
      },
    })
    if (organizationId && providerSubscriptionId) {
      const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60_000)
      const status = eventType.replace("subscription.", "") || String(entity.status || "")
      await prisma.subscription.upsert({
        where: { provider_providerSubscriptionId: { provider: "razorpay", providerSubscriptionId } },
        update: {
          status,
          quantity: Number(entity.quantity || 1),
          ...(status === "active" ? { graceEndsAt: null } : {}),
          ...(["pending", "halted"].includes(status) ? { graceEndsAt } : {}),
        },
        create: {
          organizationId,
          planId: String(notes.planId || ""),
          provider: "razorpay",
          providerSubscriptionId,
          status,
          billingInterval: String(notes.interval || "monthly"),
          quantity: Number(entity.quantity || 1),
          ...(["pending", "halted"].includes(status) ? { graceEndsAt } : {}),
        },
      })
    }
    await prisma.billingEvent.update({
      where: { provider_providerEventId: { provider: "razorpay", providerEventId } },
      data: { status: "processed", processedAt: new Date() },
    })
    res.sendStatus(200)
  } catch (error) {
    console.error("[webhooks] Razorpay webhook failed", error)
    res.sendStatus(400)
  }
})

webhooksRouter.post("/stripe", rawJson, async (req, res) => {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ""))
    const signature = req.header("stripe-signature") || ""
    const unverified = JSON.parse(raw.toString("utf8")) as {
      data?: { object?: { metadata?: { organizationId?: string } } }
    }
    const hintedOrganizationId = unverified.data?.object?.metadata?.organizationId || ""
    const credentialCandidates: Array<{ secretKey: string; webhookSecret: string }> = []
    if (hintedOrganizationId) {
      const stored = await integrationConfig<{ secretKey?: string; webhookSecret?: string }>(
        hintedOrganizationId,
        "stripe",
      )
      if (stored?.secretKey && stored.webhookSecret) {
        credentialCandidates.push({
          secretKey: stored.secretKey,
          webhookSecret: stored.webhookSecret,
        })
      }
    } else {
      const connections = await prisma.integrationConnection.findMany({
        where: { provider: "stripe", status: "configured" },
      })
      for (const connection of connections) {
        const config = decryptConfig<{ secretKey?: string; webhookSecret?: string }>(connection.encryptedConfig)
        if (config?.secretKey && config.webhookSecret) {
          credentialCandidates.push({
            secretKey: config.secretKey,
            webhookSecret: config.webhookSecret,
          })
        }
      }
    }
    if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
      credentialCandidates.push({
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      })
    }
    if (!credentialCandidates.length) {
      res.sendStatus(503)
      return
    }
    let event: Stripe.Event | null = null
    for (const credentials of credentialCandidates) {
      try {
        event = new Stripe(credentials.secretKey).webhooks.constructEvent(
          raw,
          signature,
          credentials.webhookSecret,
        )
        break
      } catch {
      }
    }
    if (!event) {
      res.sendStatus(401)
      return
    }
    const object = event.data.object as Stripe.Subscription | Stripe.Invoice | Stripe.Checkout.Session
    const metadata = "metadata" in object && object.metadata ? object.metadata : {}
    const organizationId = metadata.organizationId || (
      event.type === "checkout.session.completed"
      && "client_reference_id" in object
        ? object.client_reference_id || ""
        : ""
    )
    await prisma.billingEvent.upsert({
      where: { provider_providerEventId: { provider: "stripe", providerEventId: event.id } },
      update: {},
      create: {
        organizationId: organizationId || null,
        provider: "stripe",
        providerEventId: event.id,
        eventType: event.type,
        payload: JSON.parse(JSON.stringify(event)),
      },
    })
    if (event.type.startsWith("customer.subscription.")) {
      const subscription = object as Stripe.Subscription
      const orgId = subscription.metadata.organizationId
      const planId = subscription.metadata.planId
      if (orgId && planId) {
        const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60_000)
        await prisma.subscription.upsert({
          where: {
            provider_providerSubscriptionId: {
              provider: "stripe",
              providerSubscriptionId: subscription.id,
            },
          },
          update: {
            status: subscription.status,
            providerCustomerId: String(subscription.customer),
            quantity: subscription.items.data[0]?.quantity || 1,
            ...(["past_due", "unpaid"].includes(subscription.status) ? { graceEndsAt } : { graceEndsAt: null }),
          },
          create: {
            organizationId: orgId,
            planId,
            provider: "stripe",
            providerCustomerId: String(subscription.customer),
            providerSubscriptionId: subscription.id,
            status: subscription.status,
            billingInterval: subscription.metadata.interval || "monthly",
            quantity: subscription.items.data[0]?.quantity || 1,
            ...(["past_due", "unpaid"].includes(subscription.status) ? { graceEndsAt } : {}),
          },
        })
      }
    }
    await prisma.billingEvent.update({
      where: { provider_providerEventId: { provider: "stripe", providerEventId: event.id } },
      data: { status: "processed", processedAt: new Date() },
    })
    res.sendStatus(200)
  } catch (error) {
    console.error("[webhooks] Stripe webhook failed", error)
    res.sendStatus(400)
  }
})

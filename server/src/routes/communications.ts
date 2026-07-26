import { Router } from "express"
import { z } from "zod"
import prisma from "../../db/prisma.js"
import { requireAuth, requirePermission, type AuthRequest } from "../auth.js"
import { requireWritableSubscription } from "../entitlements.js"
import { env } from "../env.js"
import { providerSetup, sendEmail, sendWhatsApp, startExotelCall } from "../providers.js"
import { emitToOrganization } from "../realtime.js"

const messageInput = z.object({
  text: z.string().trim().max(50_000).optional(),
  html: z.string().max(250_000).optional(),
  subject: z.string().trim().max(300).optional(),
  templateName: z.string().trim().max(200).optional(),
  templateLanguage: z.string().trim().max(20).optional(),
  replyToMessageId: z.string().uuid().optional(),
  internalNote: z.boolean().default(false),
}).refine((value) => value.text || value.html || value.templateName, {
  message: "A message or approved template is required",
})

const integrationInput = z.object({
  provider: z.enum(["meta", "resend", "exotel", "sarvam", "razorpay", "stripe", "storage"]),
  externalAccountId: z.string().max(200).optional(),
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
})

export const communicationsRouter = Router()
communicationsRouter.use(requireAuth)
communicationsRouter.use(requirePermission("communications.read"))
communicationsRouter.use(requireWritableSubscription)

communicationsRouter.get("/integrations", async (req: AuthRequest, res, next) => {
  try {
    const configured = await prisma.integrationConnection.findMany({
      where: { organizationId: req.auth!.organizationId },
      select: {
        provider: true,
        status: true,
        externalAccountId: true,
        expiresAt: true,
        lastSyncAt: true,
        lastError: true,
        updatedDate: true,
      },
      orderBy: { provider: "asc" },
    })
    const providers = ["meta", "resend", "exotel", "sarvam", "razorpay", "stripe", "storage"] as const
    res.json({
      data: providers.map((provider) =>
        configured.find((item) => item.provider === provider)
        || {
          provider,
          status: providerSetup[provider] ? "configured" : "setup_required",
          externalAccountId: null,
        },
      ),
    })
  } catch (error) { next(error) }
})

communicationsRouter.put(
  "/integrations/:provider",
  requirePermission("organization.manage"),
  async (req: AuthRequest, res, next) => {
  try {
    if (!["platform_owner", "organization_owner", "organization_admin"].includes(req.auth?.membershipRole || "")) {
      res.status(403).json({ error: "Organization administrator access is required" })
      return
    }
    const input = integrationInput.parse({
      ...req.body,
      provider: req.params.provider,
    })
    const { saveIntegrationConfig } = await import("../integration-config.js")
    const data = await saveIntegrationConfig(
      req.auth!.organizationId,
      input.provider,
      input.config,
      input.externalAccountId,
    )
    res.json({ data })
  } catch (error) { next(error) }
  },
)

communicationsRouter.get("/reconciliation", async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.reconciliationItem.findMany({
      where: {
        organizationId: req.auth!.organizationId,
        status: String(req.query.status || "pending"),
      },
      orderBy: { createdDate: "asc" },
      take: 100,
    })
    const leadIds = data.flatMap((item) =>
      Array.isArray(item.candidateLeadIds) ? item.candidateLeadIds.map(String) : [],
    )
    const leads = await prisma.lead.findMany({
      where: { organizationId: req.auth!.organizationId, id: { in: leadIds }, deleted: false },
      select: { id: true, leadName: true, leadEmail: true, leadPhoneNumber: true },
    })
    res.json({
      data: data.map((item) => ({
        ...item,
        candidates: leads.filter((lead) =>
          Array.isArray(item.candidateLeadIds) && item.candidateLeadIds.map(String).includes(lead.id),
        ),
      })),
    })
  } catch (error) { next(error) }
})

communicationsRouter.post(
  "/reconciliation/:id/resolve",
  requirePermission("communications.send"),
  async (req: AuthRequest, res, next) => {
  try {
    const leadId = z.string().uuid().parse(req.body?.leadId)
    const item = await prisma.reconciliationItem.findFirst({
      where: {
        id: String(req.params.id),
        organizationId: req.auth!.organizationId,
        status: "pending",
      },
    })
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: req.auth!.organizationId, deleted: false },
    })
    const candidates = Array.isArray(item?.candidateLeadIds) ? item.candidateLeadIds.map(String) : []
    if (!item || !lead || !candidates.includes(lead.id)) {
      res.status(404).json({ error: "Reconciliation item or candidate lead not found" })
      return
    }
    const payload = item.payload as Record<string, unknown>
    const whatsappMessage = payload.message && typeof payload.message === "object"
      ? payload.message as Record<string, unknown>
      : null
    const providerMessageId = item.channel === "whatsapp"
      ? String(whatsappMessage?.id || "")
      : String(payload.email_id || "")
    let conversation = await prisma.conversation.findFirst({
      where: { organizationId: req.auth!.organizationId, leadId: lead.id, channel: item.channel },
    })
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId: req.auth!.organizationId,
          leadId: lead.id,
          channel: item.channel,
          assignedTo: lead.assignedTo,
          subject: item.channel === "email" ? String(payload.subject || "Inbound email") : null,
        },
      })
    }
    const text = item.channel === "whatsapp"
      ? String((whatsappMessage?.text as Record<string, unknown> | undefined)?.body || "")
      : String(payload.text || "")
    const message = await prisma.message.create({
      data: {
        organizationId: req.auth!.organizationId,
        conversationId: conversation.id,
        providerMessageId: providerMessageId || undefined,
        direction: "inbound",
        type: item.channel === "email" && payload.html ? "html" : "text",
        sender: item.identifier,
        recipient: item.channel === "email" ? String(payload.to || "") : null,
        text,
        html: item.channel === "email" ? String(payload.html || "") : null,
        status: "delivered",
        deliveredAt: new Date(),
        metadata: JSON.parse(JSON.stringify(payload)),
      },
    })
    const data = await prisma.reconciliationItem.update({
      where: { id: item.id },
      data: {
        status: "resolved",
        resolvedLeadId: lead.id,
        resolvedBy: req.auth!.userId,
        resolvedAt: new Date(),
      },
    })
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { unreadCount: { increment: 1 }, lastMessageAt: new Date(), status: "open" },
    })
    emitToOrganization(req.auth!.organizationId, "conversation.message", {
      conversationId: conversation.id,
      leadId: lead.id,
      channel: item.channel,
      messageId: message.id,
    })
    res.json({ data })
  } catch (error) { next(error) }
  },
)

communicationsRouter.get("/conversations", async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.conversation.findMany({
      where: {
        organizationId: req.auth!.organizationId,
        ...(req.query.channel ? { channel: String(req.query.channel) } : {}),
        ...(req.query.status ? { status: String(req.query.status) } : {}),
        ...(req.query.assignedTo ? { assignedTo: String(req.query.assignedTo) } : {}),
        ...(req.query.unread === "true" ? { unreadCount: { gt: 0 } } : {}),
        ...(req.query.leadId ? { leadId: String(req.query.leadId) } : {}),
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdDate: "desc" }],
      take: 100,
    })
    const leadIds = data.map((item) => item.leadId).filter((item): item is string => Boolean(item))
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds }, organizationId: req.auth!.organizationId },
      select: { id: true, leadName: true, leadEmail: true, leadPhoneNumber: true, priority: true },
    })
    res.json({
      data: data.map((conversation) => ({
        ...conversation,
        lead: leads.find((lead) => lead.id === conversation.leadId) || null,
      })),
    })
  } catch (error) { next(error) }
})

communicationsRouter.post(
  "/leads/:leadId/conversations",
  requirePermission("communications.send"),
  async (req: AuthRequest, res, next) => {
  try {
    const channel = z.enum(["whatsapp", "email"]).parse(req.body?.channel)
    const lead = await prisma.lead.findFirst({
      where: { id: String(req.params.leadId), organizationId: req.auth!.organizationId, deleted: false },
    })
    if (!lead) {
      res.status(404).json({ error: "Lead not found" })
      return
    }
    let conversation = await prisma.conversation.findFirst({
      where: {
        organizationId: req.auth!.organizationId,
        leadId: lead.id,
        channel,
      },
      orderBy: { createdDate: "asc" },
    })
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId: req.auth!.organizationId,
          leadId: lead.id,
          channel,
          assignedTo: lead.assignedTo || req.auth!.userId,
          subject: channel === "email" ? `Conversation with ${lead.leadName || "lead"}` : null,
        },
      })
    }
    res.status(201).json({ data: conversation })
  } catch (error) { next(error) }
  },
)

communicationsRouter.get("/conversations/:id/messages", async (req: AuthRequest, res, next) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: String(req.params.id), organizationId: req.auth!.organizationId },
    })
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" })
      return
    }
    const take = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
    const cursor = String(req.query.cursor || "")
    const data = await prisma.message.findMany({
      where: { conversationId: conversation.id, organizationId: req.auth!.organizationId },
      orderBy: { createdDate: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const hasMore = data.length > take
    const page = (hasMore ? data.slice(0, take) : data).reverse()
    res.json({
      data: page,
      meta: { nextCursor: hasMore ? data[take - 1]?.id || null : null, hasMore },
    })
  } catch (error) { next(error) }
})

communicationsRouter.post(
  "/conversations/:id/messages",
  requirePermission("communications.send"),
  async (req: AuthRequest, res, next) => {
  try {
    const input = messageInput.parse(req.body)
    const conversation = await prisma.conversation.findFirst({
      where: { id: String(req.params.id), organizationId: req.auth!.organizationId },
    })
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" })
      return
    }
    const lead = conversation.leadId
      ? await prisma.lead.findFirst({
          where: { id: conversation.leadId, organizationId: req.auth!.organizationId, deleted: false },
        })
      : null
    if (!lead) {
      res.status(409).json({ error: "This conversation is not linked to an active lead" })
      return
    }
    if (input.internalNote) {
      const note = await prisma.message.create({
        data: {
          organizationId: req.auth!.organizationId,
          conversationId: conversation.id,
          direction: "internal",
          type: "note",
          sender: req.auth!.userId,
          text: input.text,
          status: "noted",
          createdBy: req.auth!.userId,
        },
      })
      await prisma.activityEvent.create({
        data: {
          organizationId: req.auth!.organizationId,
          leadId: lead.id,
          actorUserId: req.auth!.userId,
          type: "conversation.note",
          title: "Internal conversation note added",
          metadata: { conversationId: conversation.id, messageId: note.id },
        },
      })
      emitToOrganization(req.auth!.organizationId, "conversation.message", {
        conversationId: conversation.id,
        leadId: lead.id,
        channel: conversation.channel,
        messageId: note.id,
      })
      res.status(201).json({ data: note })
      return
    }
    if (
      conversation.channel === "whatsapp"
      && (!conversation.customerWindowEndsAt || conversation.customerWindowEndsAt <= new Date())
      && !input.templateName
    ) {
      res.status(409).json({
        error: "The 24-hour WhatsApp service window is closed. Select an approved message template.",
        code: "WHATSAPP_TEMPLATE_REQUIRED",
      })
      return
    }
    if (conversation.channel === "email") {
      const suppressed = await prisma.suppressionEntry.findUnique({
        where: {
          organizationId_channel_address: {
            organizationId: req.auth!.organizationId,
            channel: "email",
            address: String(lead.leadEmail || "").toLowerCase(),
          },
        },
      })
      if (suppressed) {
        res.status(409).json({ error: `Email is suppressed: ${suppressed.reason}` })
        return
      }
    }
    const reply = input.replyToMessageId
      ? await prisma.message.findFirst({
          where: {
            id: input.replyToMessageId,
            conversationId: conversation.id,
            organizationId: req.auth!.organizationId,
          },
        })
      : null
    const message = await prisma.message.create({
      data: {
        organizationId: req.auth!.organizationId,
        conversationId: conversation.id,
        direction: "outbound",
        type: input.templateName ? "template" : input.html ? "html" : "text",
        sender: req.auth!.userId,
        recipient: conversation.channel === "whatsapp" ? lead.phoneE164 || lead.leadPhoneNumber : lead.leadEmail,
        text: input.text,
        html: input.html,
        templateName: input.templateName,
        replyToMessageId: reply?.id,
        status: "queued",
        createdBy: req.auth!.userId,
      },
    })
    try {
      const result = conversation.channel === "whatsapp"
        ? await sendWhatsApp({
            organizationId: req.auth!.organizationId,
            to: lead.phoneE164 || lead.leadPhoneNumber || "",
            text: input.text,
            templateName: input.templateName,
            templateLanguage: input.templateLanguage,
            replyToProviderMessageId: reply?.providerMessageId || undefined,
          })
        : await sendEmail({
            organizationId: req.auth!.organizationId,
            to: lead.leadEmail || "",
            text: input.text,
            html: input.html,
            subject: input.subject || conversation.subject || `Message from MooNsEstate`,
          })
      const sentAt = new Date()
      const updated = await prisma.message.update({
        where: { id: message.id },
        data: {
          providerMessageId: result.providerMessageId,
          status: result.status,
          sentAt,
          metadata: result.raw ? JSON.parse(JSON.stringify(result.raw)) : undefined,
        },
      })
      await Promise.all([
        prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: sentAt, status: "open" },
        }),
        prisma.lead.update({
          where: { id: lead.id },
          data: { firstRespondedAt: lead.firstRespondedAt || sentAt },
        }),
        prisma.activityEvent.create({
          data: {
            organizationId: req.auth!.organizationId,
            leadId: lead.id,
            actorUserId: req.auth!.userId,
            type: `${conversation.channel}.sent`,
            title: `${conversation.channel === "whatsapp" ? "WhatsApp" : "Email"} sent`,
            metadata: { conversationId: conversation.id, messageId: message.id },
          },
        }),
        prisma.usageLedger.create({
          data: {
            organizationId: req.auth!.organizationId,
            usageType: `${conversation.channel}_outbound`,
            quantity: 1,
            referenceType: "message",
            referenceId: message.id,
          },
        }),
      ])
      emitToOrganization(req.auth!.organizationId, "conversation.message", {
        conversationId: conversation.id,
        leadId: lead.id,
        channel: conversation.channel,
        messageId: updated.id,
      })
      res.status(201).json({ data: updated })
    } catch (error) {
      const failed = await prisma.message.update({
        where: { id: message.id },
        data: {
          status: "failed",
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "Provider request failed",
        },
      })
      res.status(503).json({ error: failed.errorMessage, data: failed })
    }
  } catch (error) { next(error) }
  },
)

communicationsRouter.post(
  "/conversations/:id/read",
  requirePermission("communications.send"),
  async (req: AuthRequest, res, next) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: String(req.params.id), organizationId: req.auth!.organizationId },
    })
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" })
      return
    }
    const data = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { unreadCount: 0 },
    })
    res.json({ data })
  } catch (error) { next(error) }
  },
)

communicationsRouter.post(
  "/conversations/:id/assign",
  requirePermission("communications.send"),
  async (req: AuthRequest, res, next) => {
  try {
    const assignedTo = z.string().uuid().nullable().parse(req.body?.assignedTo)
    const conversation = await prisma.conversation.findFirst({
      where: { id: String(req.params.id), organizationId: req.auth!.organizationId },
    })
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" })
      return
    }
    const data = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { assignedTo },
    })
    res.json({ data })
  } catch (error) { next(error) }
  },
)

communicationsRouter.post(
  "/leads/:leadId/calls",
  requirePermission("communications.send"),
  async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      agentNumber: z.string().min(7).max(24),
      consentedToRecording: z.boolean(),
      notes: z.string().max(10_000).optional(),
    }).parse(req.body)
    const lead = await prisma.lead.findFirst({
      where: { id: String(req.params.leadId), organizationId: req.auth!.organizationId, deleted: false },
    })
    if (!lead?.leadPhoneNumber) {
      res.status(404).json({ error: "Lead or lead phone number not found" })
      return
    }
    const call = await prisma.callRecord.create({
      data: {
        organizationId: req.auth!.organizationId,
        leadId: lead.id,
        direction: "outbound",
        fromNumber: input.agentNumber,
        toNumber: lead.phoneE164 || lead.leadPhoneNumber,
        agentUserId: req.auth!.userId,
        consentedToRecording: input.consentedToRecording,
        notes: input.notes,
        status: "queued",
      },
    })
    try {
      const callbackUrl = `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/api/webhooks/exotel`
      const result = await startExotelCall({
        organizationId: req.auth!.organizationId,
        agentNumber: input.agentNumber,
        customerNumber: lead.phoneE164 || lead.leadPhoneNumber,
        callbackUrl,
        record: input.consentedToRecording,
        customField: JSON.stringify({
          organizationId: req.auth!.organizationId,
          callId: call.id,
          leadId: lead.id,
        }),
      })
      const data = await prisma.callRecord.update({
        where: { id: call.id },
        data: {
          providerCallId: result.providerCallId,
          status: "initiated",
          metadata: JSON.parse(JSON.stringify(result.raw)),
        },
      })
      await prisma.usageLedger.create({
        data: {
          organizationId: req.auth!.organizationId,
          usageType: "call_initiated",
          quantity: 1,
          referenceType: "call",
          referenceId: call.id,
        },
      })
      res.status(201).json({ data })
    } catch (error) {
      const failed = await prisma.callRecord.update({
        where: { id: call.id },
        data: { status: "failed", notes: `${input.notes || ""}\n${error instanceof Error ? error.message : "Provider failed"}`.trim() },
      })
      res.status(503).json({ error: error instanceof Error ? error.message : "Call failed", data: failed })
    }
  } catch (error) { next(error) }
  },
)

communicationsRouter.get("/leads/:leadId/calls", async (req: AuthRequest, res, next) => {
  try {
    const leadId = String(req.params.leadId)
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: req.auth!.organizationId, deleted: false },
      select: { id: true },
    })
    if (!lead) {
      res.status(404).json({ error: "Lead not found" })
      return
    }
    const calls = await prisma.callRecord.findMany({
      where: { organizationId: req.auth!.organizationId, leadId },
      orderBy: { createdDate: "desc" },
      take: 100,
    })
    const callIds = calls.map((call) => call.id)
    const [recordings, transcripts] = await Promise.all([
      prisma.callRecording.findMany({ where: { callId: { in: callIds } } }),
      prisma.transcript.findMany({ where: { callId: { in: callIds } } }),
    ])
    const data = calls.map((call) => ({
      ...call,
      recording: recordings.find((recording) => recording.callId === call.id) || null,
      transcript: transcripts.find((transcript) => transcript.callId === call.id) || null,
    }))
    res.json({ data })
  } catch (error) { next(error) }
})

communicationsRouter.get("/calls/:id", async (req: AuthRequest, res, next) => {
  try {
    const call = await prisma.callRecord.findFirst({
      where: { id: String(req.params.id), organizationId: req.auth!.organizationId },
    })
    if (!call) {
      res.status(404).json({ error: "Call not found" })
      return
    }
    const [recording, transcript] = await Promise.all([
      prisma.callRecording.findUnique({ where: { callId: call.id } }),
      prisma.transcript.findUnique({ where: { callId: call.id } }),
    ])
    res.json({ data: { ...call, recording, transcript } })
  } catch (error) { next(error) }
})

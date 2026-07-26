import { createHmac, timingSafeEqual } from "node:crypto"
import { env } from "./env.js"
import { integrationConfig } from "./integration-config.js"

export type SendMessageInput = {
  organizationId: string
  to: string
  text?: string
  html?: string
  subject?: string
  templateName?: string
  templateLanguage?: string
  replyToProviderMessageId?: string
}

export type ProviderSendResult = {
  providerMessageId: string
  status: "sent" | "queued"
  raw?: unknown
}

type MetaConfig = {
  accessToken?: string
  phoneNumberId?: string
  wabaId?: string
  pageId?: string
  adAccountId?: string
  datasetId?: string
}

type ResendConfig = {
  apiKey?: string
  fromEmail?: string
}

type ExotelConfig = {
  accountSid?: string
  apiKey?: string
  apiToken?: string
  callerId?: string
  callbackToken?: string
  region?: "mumbai" | "singapore"
}

const configured = (values: Array<string | undefined | null>) => values.every(Boolean)
const geocodeCache = new Map<string, {
  expiresAt: number
  data: Array<{
    id: string
    label: string
    latitude?: number
    longitude?: number
    city?: string
    state?: string
    postcode?: string
  }>
}>()

export const normalizePhone = (value: unknown) => {
  const digits = String(value || "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.length === 10) return `+91${digits}`
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`
  return `+${digits}`
}

export const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase()

const graphUrl = (path: string) => `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${path}`

export async function metaConfigFor(organizationId: string): Promise<MetaConfig> {
  const stored = await integrationConfig<MetaConfig>(organizationId, "meta")
  return stored || {
    accessToken: env.META_ACCESS_TOKEN,
    phoneNumberId: env.META_PHONE_NUMBER_ID,
    wabaId: env.META_WABA_ID,
    pageId: env.META_PAGE_ID,
    adAccountId: env.META_AD_ACCOUNT_ID,
    datasetId: env.META_DATASET_ID,
  }
}

export async function sendWhatsApp(input: SendMessageInput): Promise<ProviderSendResult> {
  const config = await metaConfigFor(input.organizationId)
  if (!configured([config.accessToken, config.phoneNumberId])) {
    throw new Error("Meta WhatsApp is not configured for this workspace")
  }
  const body = input.templateName
    ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizePhone(input.to).replace("+", ""),
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.templateLanguage || "en_US" },
        },
      }
    : {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizePhone(input.to).replace("+", ""),
        type: "text",
        text: { preview_url: true, body: input.text || "" },
        ...(input.replyToProviderMessageId
          ? { context: { message_id: input.replyToProviderMessageId } }
          : {}),
      }
  const response = await fetch(graphUrl(`${config.phoneNumberId}/messages`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const raw = await response.json() as { messages?: Array<{ id?: string }>; error?: { message?: string } }
  if (!response.ok) throw new Error(raw.error?.message || "WhatsApp message could not be sent")
  const providerMessageId = raw.messages?.[0]?.id
  if (!providerMessageId) throw new Error("Meta did not return a WhatsApp message ID")
  return { providerMessageId, status: "sent", raw }
}

export async function sendEmail(input: SendMessageInput): Promise<ProviderSendResult> {
  const stored = await integrationConfig<ResendConfig>(input.organizationId, "resend")
  const apiKey = stored?.apiKey || env.RESEND_API_KEY
  const fromEmail = stored?.fromEmail || env.RESEND_FROM_EMAIL
  if (!configured([apiKey, fromEmail])) throw new Error("Resend email is not configured for this workspace")
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.to],
      subject: input.subject || "Message from MooNsEstate",
      text: input.text,
      html: input.html,
    }),
  })
  const raw = await response.json() as { id?: string; message?: string }
  if (!response.ok || !raw.id) throw new Error(raw.message || "Email could not be sent")
  return { providerMessageId: raw.id, status: "sent", raw }
}

export async function startExotelCall(input: {
  organizationId: string
  agentNumber: string
  customerNumber: string
  callbackUrl: string
  record: boolean
  customField: string
}) {
  const stored = await integrationConfig<ExotelConfig>(input.organizationId, "exotel")
  const accountSid = stored?.accountSid || env.EXOTEL_ACCOUNT_SID
  const apiKey = stored?.apiKey || env.EXOTEL_API_KEY
  const apiToken = stored?.apiToken || env.EXOTEL_API_TOKEN
  const callerId = stored?.callerId || env.EXOTEL_CALLER_ID
  const callbackToken = stored?.callbackToken || env.EXOTEL_CALLBACK_TOKEN
  const region = stored?.region || env.EXOTEL_REGION
  if (!configured([accountSid, apiKey, apiToken, callerId, callbackToken])) {
    throw new Error("Exotel calling is not configured for this workspace")
  }
  const callbackUrl = new URL(input.callbackUrl)
  callbackUrl.searchParams.set("token", String(callbackToken))
  const base = region === "singapore" ? "https://api.exotel.com" : "https://api.in.exotel.com"
  const body = new URLSearchParams({
    From: normalizePhone(input.agentNumber),
    To: normalizePhone(input.customerNumber),
    CallerId: String(callerId),
    StatusCallback: callbackUrl.toString(),
    "StatusCallbackEvents[0]": "terminal",
    "StatusCallbackEvents[1]": "answered",
    "StatusCallbackEvents[2]": "ringing",
    Record: input.record ? "true" : "false",
    CustomField: input.customField,
  })
  const response = await fetch(`${base}/v1/Accounts/${accountSid}/Calls/connect.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
  const raw = await response.json() as Record<string, unknown>
  if (!response.ok) throw new Error(String(raw.message || raw.error || "Exotel call could not be started"))
  const call = (raw.Call || raw.call || raw) as Record<string, unknown>
  const providerCallId = String(call.Sid || call.sid || call.CallSid || "")
  if (!providerCallId) throw new Error("Exotel did not return a call ID")
  return { providerCallId, raw }
}

export async function geocodeAddress(query: string) {
  if (!env.GEOAPIFY_API_KEY) throw new Error("GEOAPIFY_API_KEY is required for address autocomplete")
  const cacheKey = query.trim().toLowerCase()
  const cached = geocodeCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.data
  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete")
  url.searchParams.set("text", query)
  url.searchParams.set("filter", "countrycode:in")
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "6")
  url.searchParams.set("apiKey", env.GEOAPIFY_API_KEY)
  const response = await fetch(url)
  if (!response.ok) throw new Error("Address suggestions are temporarily unavailable")
  const payload = await response.json() as {
    results?: Array<{
      place_id?: string
      formatted?: string
      lat?: number
      lon?: number
      city?: string
      state?: string
      postcode?: string
    }>
  }
  const data = (payload.results || []).map((item) => ({
    id: item.place_id || `${item.lat},${item.lon}`,
    label: item.formatted || "",
    latitude: item.lat,
    longitude: item.lon,
    city: item.city,
    state: item.state,
    postcode: item.postcode,
  }))
  if (geocodeCache.size >= 500) {
    const oldestKey = geocodeCache.keys().next().value
    if (oldestKey) geocodeCache.delete(oldestKey)
  }
  geocodeCache.set(cacheKey, { data, expiresAt: Date.now() + 5 * 60_000 })
  return data
}

export const verifyHmac = (
  payload: string | Buffer,
  received: string | undefined,
  secret: string | undefined,
  encoding: "hex" | "base64" = "hex",
) => {
  if (!received || !secret) return false
  const expected = createHmac("sha256", secret).update(payload).digest(encoding)
  const left = Buffer.from(received.replace(/^sha256=/, ""))
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export const providerSetup = {
  meta: configured([
    env.META_APP_ID,
    env.META_APP_SECRET,
    env.META_WEBHOOK_VERIFY_TOKEN,
    env.META_ACCESS_TOKEN,
    env.META_PAGE_ID,
    env.META_PHONE_NUMBER_ID,
  ]),
  resend: configured([env.RESEND_API_KEY, env.RESEND_FROM_EMAIL]),
  exotel: configured([env.EXOTEL_ACCOUNT_SID, env.EXOTEL_API_KEY, env.EXOTEL_API_TOKEN, env.EXOTEL_CALLER_ID, env.EXOTEL_CALLBACK_TOKEN]),
  sarvam: configured([env.SARVAM_API_KEY]),
  razorpay: configured([env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, env.RAZORPAY_WEBHOOK_SECRET]),
  stripe: configured([env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET]),
  geoapify: configured([env.GEOAPIFY_API_KEY]),
  redis: configured([env.REDIS_URL]),
  storage: configured([env.S3_BUCKET, env.S3_ACCESS_KEY_ID, env.S3_SECRET_ACCESS_KEY]),
}

import { createHash } from "node:crypto"
import prisma from "../db/prisma.js"
import { env } from "./env.js"
import { decryptConfig } from "./integration-config.js"
import { metaConfigFor, normalizeEmail, normalizePhone } from "./providers.js"

type MetaConfig = {
  accessToken?: string
  pageId?: string
  adAccountId?: string
  datasetId?: string
}

type MetaLead = {
  id?: string
  created_time?: string
  field_data?: Array<{ name?: string; values?: string[] }>
  ad_id?: string
  adset_id?: string
  campaign_id?: string
  form_id?: string
  page_id?: string
  [key: string]: unknown
}

const graphUrl = (path: string) => `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${path}`

const graphGet = async <T>(path: string, accessToken: string) => {
  const separator = path.includes("?") ? "&" : "?"
  const response = await fetch(`${graphUrl(path)}${separator}access_token=${encodeURIComponent(accessToken)}`)
  const payload = await response.json() as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message || "Meta Graph API request failed")
  return payload
}

export async function metaConnectionForPage(pageId: string) {
  const exact = await prisma.integrationConnection.findFirst({
    where: { provider: "meta", externalAccountId: pageId, status: "configured" },
  })
  if (exact) {
    const config = decryptConfig<MetaConfig>(exact.encryptedConfig)
    if (config) return { organizationId: exact.organizationId, config }
  }
  const candidates = await prisma.integrationConnection.findMany({
    where: { provider: "meta", status: "configured" },
  })
  for (const candidate of candidates) {
    const config = decryptConfig<MetaConfig>(candidate.encryptedConfig)
    if (config?.pageId === pageId) return { organizationId: candidate.organizationId, config }
  }
  if (env.META_PAGE_ID === pageId && env.META_ACCESS_TOKEN && env.META_ORGANIZATION_ID) {
    return {
      organizationId: env.META_ORGANIZATION_ID,
      config: await metaConfigFor(env.META_ORGANIZATION_ID),
    }
  }
  return null
}

const fieldMap = (fieldData?: MetaLead["field_data"]) => {
  const fields = new Map<string, string>()
  for (const item of fieldData || []) {
    if (item.name) fields.set(item.name.toLowerCase(), item.values?.join(", ") || "")
  }
  return fields
}

const first = (fields: Map<string, string>, names: string[]) => {
  for (const name of names) {
    const value = fields.get(name)
    if (value) return value
  }
  return ""
}

const graphObject = async (
  externalId: string | undefined,
  fields: string,
  accessToken: string,
) => {
  if (!externalId) return null
  return graphGet<Record<string, unknown>>(`${externalId}?fields=${fields}`, accessToken)
}

async function leastBusyAgent(organizationId: string) {
  const agents = await prisma.membership.findMany({
    where: {
      organizationId,
      status: "active",
      role: { in: ["agent", "sales_manager", "organization_owner", "organization_admin"] },
    },
    orderBy: { createdDate: "asc" },
  })
  if (!agents.length) return null
  const scored = await Promise.all(agents.map(async (agent) => ({
    userId: agent.userId,
    count: await prisma.lead.count({
      where: {
        organizationId,
        assignedTo: agent.userId,
        deleted: false,
        leadStatus: { notIn: ["Converted", "Closed Lost"] },
      },
    }),
  })))
  scored.sort((a, b) => a.count - b.count)
  return scored[0]?.userId || null
}

export async function hydrateMetaLead(
  organizationId: string,
  metaLeadId: string,
  webhookPayload: Record<string, unknown>,
) {
  const config = await metaConfigFor(organizationId)
  if (!config?.accessToken) throw new Error("Meta access token is unavailable")
  const data = await graphGet<MetaLead>(
    `${metaLeadId}?fields=id,created_time,field_data,ad_id,adset_id,campaign_id,form_id,page_id`,
    config.accessToken,
  )
  const fields = fieldMap(data.field_data)
  const fullName = first(fields, ["full_name", "name"])
    || [first(fields, ["first_name"]), first(fields, ["last_name"])].filter(Boolean).join(" ")
    || "Meta lead"
  const email = normalizeEmail(first(fields, ["email", "work_email"]))
  const phone = normalizePhone(first(fields, ["phone_number", "phone", "mobile_number"]))
  const address = first(fields, ["city", "location", "address", "street_address"])
  const submittedAt = data.created_time ? new Date(data.created_time) : new Date()

  const existingByMeta = await prisma.lead.findFirst({
    where: { organizationId, metaLeadId, deleted: false },
  })
  const existingByIdentity = existingByMeta || await prisma.lead.findFirst({
    where: {
      organizationId,
      deleted: false,
      OR: [
        ...(phone ? [{ phoneE164: phone }] : []),
        ...(email ? [{ leadEmail: email }] : []),
      ],
    },
  })
  const assignedTo = existingByIdentity?.assignedTo || await leastBusyAgent(organizationId)
  const firstResponseDueAt = new Date(Date.now() + 5 * 60_000)
  const lead = existingByIdentity
    ? await prisma.lead.update({
        where: { id: existingByIdentity.id },
        data: {
          metaLeadId,
          leadName: existingByIdentity.leadName || fullName,
          leadEmail: existingByIdentity.leadEmail || email || null,
          leadPhoneNumber: existingByIdentity.leadPhoneNumber || phone || null,
          phoneE164: existingByIdentity.phoneE164 || phone || null,
          leadAddress: existingByIdentity.leadAddress || address || null,
          leadSource: "Meta Lead Ads",
          assignedTo,
        },
      })
    : await prisma.lead.create({
        data: {
          organizationId,
          metaLeadId,
          leadName: fullName,
          leadEmail: email || null,
          leadPhoneNumber: phone || null,
          phoneE164: phone || null,
          leadAddress: address || null,
          leadStatus: "New",
          leadSource: "Meta Lead Ads",
          priority: "High",
          assignedTo,
          firstResponseDueAt,
        },
      })

  await prisma.metaLeadSubmission.upsert({
    where: { organizationId_externalId: { organizationId, externalId: metaLeadId } },
    update: {
      leadId: lead.id,
      campaignExternalId: data.campaign_id,
      adSetExternalId: data.adset_id,
      adExternalId: data.ad_id,
      formExternalId: data.form_id,
      pageExternalId: data.page_id,
      fieldData: data.field_data ? JSON.parse(JSON.stringify(data.field_data)) : undefined,
      raw: JSON.parse(JSON.stringify(data)),
      submittedAt,
      hydratedAt: new Date(),
      status: "hydrated",
    },
    create: {
      organizationId,
      externalId: metaLeadId,
      leadId: lead.id,
      campaignExternalId: data.campaign_id,
      adSetExternalId: data.adset_id,
      adExternalId: data.ad_id,
      formExternalId: data.form_id,
      pageExternalId: data.page_id,
      fieldData: data.field_data ? JSON.parse(JSON.stringify(data.field_data)) : undefined,
      raw: JSON.parse(JSON.stringify(data)),
      submittedAt,
      hydratedAt: new Date(),
      status: "hydrated",
    },
  })

  const [campaign, adSet, ad, form] = await Promise.all([
    graphObject(data.campaign_id, "id,name,objective,status,effective_status,daily_budget,lifetime_budget", config.accessToken),
    graphObject(data.adset_id, "id,name,status,targeting,campaign_id", config.accessToken),
    graphObject(data.ad_id, "id,name,status,creative{id,thumbnail_url,image_url},campaign_id,adset_id", config.accessToken),
    graphObject(data.form_id, "id,name,status,questions", config.accessToken),
  ])

  if (campaign && data.campaign_id) {
    await prisma.metaCampaign.upsert({
      where: { organizationId_externalId: { organizationId, externalId: data.campaign_id } },
      update: {
        name: String(campaign.name || data.campaign_id),
        objective: campaign.objective ? String(campaign.objective) : null,
        status: campaign.status ? String(campaign.status) : null,
        effectiveStatus: campaign.effective_status ? String(campaign.effective_status) : null,
        dailyBudget: campaign.daily_budget ? String(campaign.daily_budget) : null,
        lifetimeBudget: campaign.lifetime_budget ? String(campaign.lifetime_budget) : null,
        raw: JSON.parse(JSON.stringify(campaign)),
      },
      create: {
        organizationId,
        externalId: data.campaign_id,
        name: String(campaign.name || data.campaign_id),
        objective: campaign.objective ? String(campaign.objective) : null,
        status: campaign.status ? String(campaign.status) : null,
        effectiveStatus: campaign.effective_status ? String(campaign.effective_status) : null,
        dailyBudget: campaign.daily_budget ? String(campaign.daily_budget) : null,
        lifetimeBudget: campaign.lifetime_budget ? String(campaign.lifetime_budget) : null,
        raw: JSON.parse(JSON.stringify(campaign)),
      },
    })
  }
  if (adSet && data.adset_id && data.campaign_id) {
    await prisma.metaAdSet.upsert({
      where: { organizationId_externalId: { organizationId, externalId: data.adset_id } },
      update: {
        campaignExternalId: data.campaign_id,
        name: String(adSet.name || data.adset_id),
        status: adSet.status ? String(adSet.status) : null,
        targetingSummary: adSet.targeting ? JSON.parse(JSON.stringify(adSet.targeting)) : undefined,
        raw: JSON.parse(JSON.stringify(adSet)),
      },
      create: {
        organizationId,
        externalId: data.adset_id,
        campaignExternalId: data.campaign_id,
        name: String(adSet.name || data.adset_id),
        status: adSet.status ? String(adSet.status) : null,
        targetingSummary: adSet.targeting ? JSON.parse(JSON.stringify(adSet.targeting)) : undefined,
        raw: JSON.parse(JSON.stringify(adSet)),
      },
    })
  }
  if (ad && data.ad_id && data.adset_id && data.campaign_id) {
    const creative = ad.creative && typeof ad.creative === "object"
      ? ad.creative as Record<string, unknown>
      : {}
    await prisma.metaAd.upsert({
      where: { organizationId_externalId: { organizationId, externalId: data.ad_id } },
      update: {
        campaignExternalId: data.campaign_id,
        adSetExternalId: data.adset_id,
        name: String(ad.name || data.ad_id),
        status: ad.status ? String(ad.status) : null,
        creativeId: creative.id ? String(creative.id) : null,
        creativePreviewUrl: creative.thumbnail_url
          ? String(creative.thumbnail_url)
          : creative.image_url ? String(creative.image_url) : null,
        raw: JSON.parse(JSON.stringify(ad)),
      },
      create: {
        organizationId,
        externalId: data.ad_id,
        campaignExternalId: data.campaign_id,
        adSetExternalId: data.adset_id,
        name: String(ad.name || data.ad_id),
        status: ad.status ? String(ad.status) : null,
        creativeId: creative.id ? String(creative.id) : null,
        creativePreviewUrl: creative.thumbnail_url
          ? String(creative.thumbnail_url)
          : creative.image_url ? String(creative.image_url) : null,
        raw: JSON.parse(JSON.stringify(ad)),
      },
    })
  }
  if (form && data.form_id) {
    await prisma.metaLeadForm.upsert({
      where: { organizationId_externalId: { organizationId, externalId: data.form_id } },
      update: {
        pageExternalId: data.page_id,
        name: String(form.name || data.form_id),
        status: form.status ? String(form.status) : null,
        questions: form.questions ? JSON.parse(JSON.stringify(form.questions)) : undefined,
        raw: JSON.parse(JSON.stringify(form)),
      },
      create: {
        organizationId,
        externalId: data.form_id,
        pageExternalId: data.page_id,
        name: String(form.name || data.form_id),
        status: form.status ? String(form.status) : null,
        questions: form.questions ? JSON.parse(JSON.stringify(form.questions)) : undefined,
        raw: JSON.parse(JSON.stringify(form)),
      },
    })
  }

  await Promise.all([
    prisma.attributionTouch.create({
      data: {
        organizationId,
        leadId: lead.id,
        source: "meta_lead_ads",
        campaignExternalId: data.campaign_id,
        adSetExternalId: data.adset_id,
        adExternalId: data.ad_id,
        formExternalId: data.form_id,
        referral: JSON.parse(JSON.stringify(webhookPayload)),
        occurredAt: submittedAt,
      },
    }),
    prisma.activityEvent.create({
      data: {
        organizationId,
        leadId: lead.id,
        type: "meta.lead_received",
        title: "Meta Lead Ad received",
        metadata: {
          metaLeadId,
          campaignId: data.campaign_id,
          adSetId: data.adset_id,
          adId: data.ad_id,
          formId: data.form_id,
        },
      },
    }),
  ])
  return lead
}

const actionValue = (actions: unknown, names: string[]) => {
  if (!Array.isArray(actions)) return 0
  return actions.reduce((sum, item) => {
    if (!item || typeof item !== "object") return sum
    const record = item as Record<string, unknown>
    return names.includes(String(record.action_type || "")) ? sum + Number(record.value || 0) : sum
  }, 0)
}

export async function syncMetaInsights(organizationId: string, since: string, until: string) {
  const config = await metaConfigFor(organizationId)
  if (!config?.accessToken || !config.adAccountId) throw new Error("Meta Ad Account is not configured")
  const accountId = config.adAccountId.startsWith("act_") ? config.adAccountId : `act_${config.adAccountId}`
  const fields = [
    "date_start", "campaign_id", "adset_id", "ad_id", "spend", "impressions", "reach",
    "frequency", "clicks", "inline_link_clicks", "actions",
  ].join(",")
  let path = `${accountId}/insights?level=ad&time_increment=1&limit=500&fields=${fields}&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`
  let synced = 0
  while (path) {
    const page = await graphGet<{
      data?: Array<Record<string, unknown>>
      paging?: { next?: string }
    }>(path, config.accessToken)
    for (const row of page.data || []) {
      const adId = String(row.ad_id || "")
      const insightDate = new Date(String(row.date_start))
      if (!adId || Number.isNaN(insightDate.getTime())) continue
      await prisma.metaInsightDaily.upsert({
        where: {
          organizationId_level_objectExternalId_insightDate: {
            organizationId,
            level: "ad",
            objectExternalId: adId,
            insightDate,
          },
        },
        update: {
          campaignExternalId: row.campaign_id ? String(row.campaign_id) : null,
          adSetExternalId: row.adset_id ? String(row.adset_id) : null,
          adExternalId: adId,
          spend: Number(row.spend || 0),
          impressions: Number(row.impressions || 0),
          reach: Number(row.reach || 0),
          frequency: Number(row.frequency || 0),
          clicks: Number(row.clicks || 0),
          linkClicks: Number(row.inline_link_clicks || 0),
          leads: actionValue(row.actions, ["lead", "onsite_conversion.lead_grouped"]),
          landingPageViews: actionValue(row.actions, ["landing_page_view"]),
          messagingConversations: actionValue(row.actions, ["onsite_conversion.messaging_conversation_started_7d"]),
          actions: row.actions ? JSON.parse(JSON.stringify(row.actions)) : undefined,
          raw: JSON.parse(JSON.stringify(row)),
        },
        create: {
          organizationId,
          level: "ad",
          objectExternalId: adId,
          insightDate,
          campaignExternalId: row.campaign_id ? String(row.campaign_id) : null,
          adSetExternalId: row.adset_id ? String(row.adset_id) : null,
          adExternalId: adId,
          spend: Number(row.spend || 0),
          impressions: Number(row.impressions || 0),
          reach: Number(row.reach || 0),
          frequency: Number(row.frequency || 0),
          clicks: Number(row.clicks || 0),
          linkClicks: Number(row.inline_link_clicks || 0),
          leads: actionValue(row.actions, ["lead", "onsite_conversion.lead_grouped"]),
          landingPageViews: actionValue(row.actions, ["landing_page_view"]),
          messagingConversations: actionValue(row.actions, ["onsite_conversion.messaging_conversation_started_7d"]),
          actions: row.actions ? JSON.parse(JSON.stringify(row.actions)) : undefined,
          raw: JSON.parse(JSON.stringify(row)),
        },
      })
      synced += 1
    }
    const next = page.paging?.next
    path = next ? next.replace(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/`, "") : ""
  }
  await prisma.integrationConnection.updateMany({
    where: { organizationId, provider: "meta" },
    data: { lastSyncAt: new Date(), lastError: null },
  })
  return synced
}

const sha256 = (value: string) => createHash("sha256").update(value.trim().toLowerCase()).digest("hex")

export async function dispatchMetaConversions(organizationId: string) {
  const config = await metaConfigFor(organizationId)
  if (!config?.accessToken || !config.datasetId) throw new Error("Meta dataset is not configured")
  const queued = await prisma.conversionDispatch.findMany({
    where: { organizationId, status: { in: ["queued", "failed"] }, attempts: { lt: 5 } },
    orderBy: { createdDate: "asc" },
    take: 100,
  })
  let sent = 0
  for (const dispatch of queued) {
    const lead = await prisma.lead.findFirst({ where: { id: dispatch.leadId, organizationId } })
    if (!lead || lead.consentStatus !== "granted") continue
    const payload = {
      data: [{
        event_name: dispatch.eventName,
        event_time: Math.floor(Date.now() / 1_000),
        event_id: dispatch.eventId,
        action_source: "system_generated",
        user_data: {
          lead_id: lead.metaLeadId,
          ...(lead.leadEmail ? { em: [sha256(lead.leadEmail)] } : {}),
          ...(lead.phoneE164 ? { ph: [sha256(lead.phoneE164)] } : {}),
        },
        custom_data: dispatch.payload,
      }],
    }
    try {
      const response = await fetch(graphUrl(`${config.datasetId}/events`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      const raw = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(raw.error?.message || "Meta conversion dispatch failed")
      await prisma.conversionDispatch.update({
        where: { id: dispatch.id },
        data: { status: "sent", dispatchedAt: new Date(), attempts: { increment: 1 }, lastError: null },
      })
      sent += 1
    } catch (error) {
      await prisma.conversionDispatch.update({
        where: { id: dispatch.id },
        data: {
          status: "failed",
          attempts: { increment: 1 },
          lastError: error instanceof Error ? error.message : "Meta conversion dispatch failed",
        },
      })
    }
  }
  return sent
}

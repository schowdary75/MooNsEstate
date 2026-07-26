import { Router } from "express"
import { z } from "zod"
import prisma from "../../db/prisma.js"
import { requireAuth, requirePermission, type AuthRequest } from "../auth.js"
import { requireWritableSubscription } from "../entitlements.js"
import { dispatchMetaConversions, syncMetaInsights } from "../meta-service.js"

export const metaRouter = Router()
metaRouter.use(requireAuth)
metaRouter.use(requirePermission("meta.read"))
metaRouter.use(requireWritableSubscription)

metaRouter.get("/meta/acquisition", async (req: AuthRequest, res, next) => {
  try {
    const until = z.coerce.date().default(new Date()).parse(req.query.until)
    const since = z.coerce.date().default(new Date(Date.now() - 30 * 24 * 60 * 60_000)).parse(req.query.since)
    const [insights, submissions, leads, campaigns, adSets, ads] = await Promise.all([
      prisma.metaInsightDaily.findMany({
        where: {
          organizationId: req.auth!.organizationId,
          insightDate: { gte: since, lte: until },
        },
        orderBy: { insightDate: "asc" },
      }),
      prisma.metaLeadSubmission.findMany({
        where: {
          organizationId: req.auth!.organizationId,
          submittedAt: { gte: since, lte: until },
        },
      }),
      prisma.lead.findMany({
        where: {
          organizationId: req.auth!.organizationId,
          metaLeadId: { not: null },
          deleted: false,
          createdDate: { gte: since, lte: until },
        },
        select: {
          id: true,
          leadStatus: true,
          convertedAt: true,
          firstRespondedAt: true,
        },
      }),
      prisma.metaCampaign.findMany({ where: { organizationId: req.auth!.organizationId } }),
      prisma.metaAdSet.findMany({ where: { organizationId: req.auth!.organizationId } }),
      prisma.metaAd.findMany({ where: { organizationId: req.auth!.organizationId } }),
    ])
    const totals = insights.reduce((result, item) => ({
      spend: result.spend + Number(item.spend),
      impressions: result.impressions + item.impressions,
      reach: result.reach + item.reach,
      clicks: result.clicks + item.clicks,
      linkClicks: result.linkClicks + item.linkClicks,
      reportedLeads: result.reportedLeads + item.leads,
      landingPageViews: result.landingPageViews + item.landingPageViews,
      messagingConversations: result.messagingConversations + item.messagingConversations,
    }), {
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      linkClicks: 0,
      reportedLeads: 0,
      landingPageViews: 0,
      messagingConversations: 0,
    })
    const qualified = leads.filter((lead) =>
      ["Qualified", "Appointment", "Offer Made", "Converted"].includes(lead.leadStatus || ""),
    ).length
    const converted = leads.filter((lead) => lead.leadStatus === "Converted").length
    const leadIds = leads.map((lead) => lead.id)
    const [siteVisits, opportunities] = await Promise.all([
      prisma.siteVisit.findMany({
        where: { organizationId: req.auth!.organizationId, leadId: { in: leadIds } },
        select: { id: true, leadId: true, status: true },
      }),
      prisma.opportunity.findMany({
        where: { organizationId: req.auth!.organizationId, leadId: { in: leadIds }, deleted: false },
        select: { id: true, leadId: true, stage: true, amount: true },
      }),
    ])
    const wonOpportunities = opportunities.filter((opportunity) =>
      ["closed won", "won"].includes(String(opportunity.stage || "").toLowerCase()),
    )
    const revenue = wonOpportunities.reduce(
      (sum, opportunity) => sum + Number(String(opportunity.amount || "").replace(/[^0-9.-]/g, "")),
      0,
    )
    const rows = campaigns.map((campaign) => {
      const campaignInsights = insights.filter((item) => item.campaignExternalId === campaign.externalId)
      const spend = campaignInsights.reduce((sum, item) => sum + Number(item.spend), 0)
      const campaignSubmissions = submissions.filter((item) => item.campaignExternalId === campaign.externalId)
      const campaignLeadIds = campaignSubmissions.map((item) => item.leadId).filter((id): id is string => Boolean(id))
      const campaignQualified = leads.filter((lead) =>
        campaignLeadIds.includes(lead.id)
        && ["Qualified", "Appointment", "Offer Made", "Converted"].includes(lead.leadStatus || ""),
      ).length
      const campaignVisits = siteVisits.filter((visit) => visit.leadId && campaignLeadIds.includes(visit.leadId)).length
      const campaignOpportunities = opportunities.filter((opportunity) =>
        opportunity.leadId && campaignLeadIds.includes(opportunity.leadId),
      )
      const campaignRevenue = campaignOpportunities
        .filter((opportunity) => ["closed won", "won"].includes(String(opportunity.stage || "").toLowerCase()))
        .reduce((sum, opportunity) => sum + Number(String(opportunity.amount || "").replace(/[^0-9.-]/g, "")), 0)
      return {
        ...campaign,
        spend,
        impressions: campaignInsights.reduce((sum, item) => sum + item.impressions, 0),
        clicks: campaignInsights.reduce((sum, item) => sum + item.clicks, 0),
        leads: campaignSubmissions.length,
        costPerLead: campaignSubmissions.length ? spend / campaignSubmissions.length : 0,
        qualified: campaignQualified,
        costPerQualifiedLead: campaignQualified ? spend / campaignQualified : 0,
        siteVisits: campaignVisits,
        costPerVisit: campaignVisits ? spend / campaignVisits : 0,
        opportunities: campaignOpportunities.length,
        wins: campaignOpportunities.filter((opportunity) =>
          ["closed won", "won"].includes(String(opportunity.stage || "").toLowerCase()),
        ).length,
        revenue: campaignRevenue,
        roas: spend ? campaignRevenue / spend : 0,
      }
    })
    res.json({
      data: {
        period: { since, until },
        totals: {
          ...totals,
          crmLeads: leads.length,
          qualified,
          converted,
          costPerLead: leads.length ? totals.spend / leads.length : 0,
          costPerQualifiedLead: qualified ? totals.spend / qualified : 0,
          siteVisits: siteVisits.length,
          costPerVisit: siteVisits.length ? totals.spend / siteVisits.length : 0,
          opportunities: opportunities.length,
          wins: wonOpportunities.length,
          revenue,
          roas: totals.spend ? revenue / totals.spend : 0,
        },
        campaigns: rows,
        adSets,
        ads,
        submissions,
      },
    })
  } catch (error) { next(error) }
})

metaRouter.post("/meta/sync", requirePermission("meta.sync"), async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(
        new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString().slice(0, 10),
      ),
      until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(new Date().toISOString().slice(0, 10)),
    }).parse(req.body || {})
    const synced = await syncMetaInsights(req.auth!.organizationId, input.since, input.until)
    res.json({ data: { synced } })
  } catch (error) { next(error) }
})

metaRouter.post("/meta/conversions/retry", requirePermission("meta.sync"), async (req: AuthRequest, res, next) => {
  try {
    const sent = await dispatchMetaConversions(req.auth!.organizationId)
    res.json({ data: { sent } })
  } catch (error) { next(error) }
})

metaRouter.get("/leads/:leadId/meta-attribution", async (req: AuthRequest, res, next) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: String(req.params.leadId), organizationId: req.auth!.organizationId, deleted: false },
    })
    if (!lead) {
      res.status(404).json({ error: "Lead not found" })
      return
    }
    const [submission, touches] = await Promise.all([
      prisma.metaLeadSubmission.findFirst({
        where: { organizationId: req.auth!.organizationId, leadId: lead.id },
        orderBy: { submittedAt: "desc" },
      }),
      prisma.attributionTouch.findMany({
        where: { organizationId: req.auth!.organizationId, leadId: lead.id },
        orderBy: { occurredAt: "desc" },
      }),
    ])
    const [campaign, adSet, ad, form] = await Promise.all([
      submission?.campaignExternalId
        ? prisma.metaCampaign.findUnique({
            where: {
              organizationId_externalId: {
                organizationId: req.auth!.organizationId,
                externalId: submission.campaignExternalId,
              },
            },
          })
        : null,
      submission?.adSetExternalId
        ? prisma.metaAdSet.findUnique({
            where: {
              organizationId_externalId: {
                organizationId: req.auth!.organizationId,
                externalId: submission.adSetExternalId,
              },
            },
          })
        : null,
      submission?.adExternalId
        ? prisma.metaAd.findUnique({
            where: {
              organizationId_externalId: {
                organizationId: req.auth!.organizationId,
                externalId: submission.adExternalId,
              },
            },
          })
        : null,
      submission?.formExternalId
        ? prisma.metaLeadForm.findUnique({
            where: {
              organizationId_externalId: {
                organizationId: req.auth!.organizationId,
                externalId: submission.formExternalId,
              },
            },
          })
        : null,
    ])
    res.json({ data: { submission, campaign, adSet, ad, form, touches } })
  } catch (error) { next(error) }
})

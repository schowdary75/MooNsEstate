import bcrypt from "bcrypt"
import cors from "cors"
import express, { type NextFunction, type Request, type Response } from "express"
import rateLimit from "express-rate-limit"
import helmet from "helmet"
import { createServer } from "node:http"
import { Server as SocketServer } from "socket.io"
import { ZodError } from "zod"
import prisma from "../db/prisma.js"
import {
  createSession,
  requireAdmin,
  requireAuth,
  requireCsrf,
  revokeSession,
  type AuthRequest,
} from "./auth.js"
import { createCrudRouter } from "./crud.js"
import { allowedOrigins, env } from "./env.js"
import { startJobWorker } from "./jobs.js"
import { setSocketServer } from "./realtime.js"
import { billingRouter } from "./routes/billing.js"
import { communicationsRouter } from "./routes/communications.js"
import { coreRouter } from "./routes/core.js"
import { metaRouter } from "./routes/meta.js"
import { portalRouter } from "./routes/portal.js"
import { webhooksRouter } from "./routes/webhooks.js"
import { ensureDefaultWorkspace } from "./tenancy.js"

const app = express()

app.disable("x-powered-by")
app.set("trust proxy", 1)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}))
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true)
    else callback(new Error("Origin is not allowed"))
  },
  credentials: true,
}))
app.use("/api/webhooks", webhooksRouter)
app.use(express.json({ limit: "2mb" }))
app.use(express.urlencoded({ extended: false, limit: "1mb" }))
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next()
    return
  }
  const origin = req.header("origin")
  if (origin && !allowedOrigins.includes(origin)) {
    res.status(403).json({ error: "Cross-origin request rejected" })
    return
  }
  next()
})
app.use(requireCsrf)

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again later." },
})

app.get("/", (_req, res) => res.json({ service: "MooNsEstate API", status: "ok" }))
app.get("/api/health", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: "ok", database: "connected" })
  } catch (error) { next(error) }
})

app.post("/api/user/login", loginLimiter, async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase()
    const password = String(req.body?.password || "")
    if (!username || !password) {
      res.status(400).json({ error: "Email and password are required" })
      return
    }
    const user = await prisma.user.findFirst({ where: { username, deleted: false } })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: "Email or password is incorrect" })
      return
    }
    const membership = await ensureDefaultWorkspace(user.id, user.role)
    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { lt: new Date() } },
      data: { revokedAt: new Date() },
    })
    await createSession(req, res, user.id, membership.organizationId, req.body?.remember !== false)
    await prisma.auditEvent.create({
      data: {
        organizationId: membership.organizationId,
        actorUserId: user.id,
        action: "session.created",
        entityType: "session",
        ipAddress: req.ip,
      },
    })
    const { password: _password, ...safeUser } = user
    res.json({
      user: { ...safeUser, _id: user.id },
      workspace: { organizationId: membership.organizationId, role: membership.role },
    })
  } catch (error) { next(error) }
})

app.post("/api/user/logout", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await revokeSession(req, res)
    res.status(204).end()
  } catch (error) { next(error) }
})

app.get("/api/user", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { organizationId: req.auth!.organizationId, status: "active" },
      orderBy: { createdDate: "desc" },
      include: { user: true },
    })
    res.json({
      data: memberships
        .filter(({ user }) => !user.deleted)
        .map(({ user, role }) => ({
          id: user.id,
          _id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          role,
          createdDate: user.createdDate,
          updatedDate: user.updatedDate,
        })),
    })
  } catch (error) { next(error) }
})

app.post("/api/user/add", requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase()
    const password = String(req.body?.password || "")
    if (!username || password.length < 8) {
      res.status(400).json({ error: "A valid email and password of at least 8 characters are required" })
      return
    }
    const membershipRole = String(req.body?.membershipRole || "agent")
    const role = await prisma.role.findUnique({
      where: {
        organizationId_name: {
          organizationId: req.auth!.organizationId,
          name: membershipRole,
        },
      },
    })
    if (!role) {
      res.status(400).json({ error: "The requested workspace role is unavailable" })
      return
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const created = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          username,
          password: passwordHash,
          firstName: req.body?.firstName || null,
          lastName: req.body?.lastName || null,
          phoneNumber: req.body?.phoneNumber ? Number(req.body.phoneNumber) : null,
          role: req.body?.role === "superAdmin" ? "superAdmin" : "user",
        },
      })
      await transaction.membership.create({
        data: {
          organizationId: req.auth!.organizationId,
          userId: user.id,
          role: membershipRole,
          roleId: role.id,
        },
      })
      return user
    })
    const { password: _password, ...safeUser } = created
    res.status(201).json({ data: safeUser })
  } catch (error) { next(error) }
})

app.put("/api/user/edit/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const targetId = String(req.params.id)
    const isAdmin = ["platform_owner", "organization_owner", "organization_admin"]
      .includes(req.auth?.membershipRole || "")
    const targetMembership = await prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: req.auth!.organizationId,
          userId: targetId,
        },
      },
    })
    if (!targetMembership || (!isAdmin && req.auth?.userId !== targetId)) {
      res.status(403).json({ error: "You cannot edit this user" })
      return
    }
    const membershipRole = isAdmin && req.body?.membershipRole
      ? String(req.body.membershipRole)
      : null
    const role = membershipRole
      ? await prisma.role.findUnique({
          where: {
            organizationId_name: {
              organizationId: req.auth!.organizationId,
              name: membershipRole,
            },
          },
        })
      : null
    if (membershipRole && !role) {
        res.status(400).json({ error: "The requested workspace role is unavailable" })
        return
    }
    const passwordHash = req.body?.password
      ? await bcrypt.hash(String(req.body.password), 12)
      : undefined
    const updated = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id: targetId },
        data: {
          username: req.body?.username ? String(req.body.username).trim().toLowerCase() : undefined,
          firstName: req.body?.firstName,
          lastName: req.body?.lastName,
          phoneNumber: req.body?.phoneNumber ? Number(req.body.phoneNumber) : null,
          password: passwordHash,
        },
      })
      if (membershipRole && role) {
        await transaction.membership.update({
          where: {
            organizationId_userId: {
              organizationId: req.auth!.organizationId,
              userId: targetId,
            },
          },
          data: { role: membershipRole, roleId: role.id },
        })
      }
      return user
    })
    const { password: _password, ...safeUser } = updated
    res.json({ data: safeUser })
  } catch (error) { next(error) }
})

app.delete("/api/user/delete/:id", requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    if (req.auth?.userId === req.params.id) {
      res.status(400).json({ error: "You cannot delete your own account" })
      return
    }
    const targetId = String(req.params.id)
    const membership = await prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: req.auth!.organizationId,
          userId: targetId,
        },
      },
    })
    if (!membership) {
      res.status(404).json({ error: "Workspace member not found" })
      return
    }
    await prisma.membership.update({ where: { id: membership.id }, data: { status: "removed" } })
    await prisma.session.updateMany({
      where: { userId: targetId, organizationId: req.auth!.organizationId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    res.json({ data: { id: targetId }, message: "Workspace access removed" })
  } catch (error) { next(error) }
})

app.use("/api/v1", portalRouter, coreRouter, communicationsRouter, metaRouter, billingRouter)

const crudRoutes: Array<[string, string]> = [
  ["lead", "Lead"],
  ["contact", "Contact"],
  ["property", "Property"],
  ["opportunity", "Opportunity"],
  ["account", "Account"],
  ["invoices", "Invoice"],
  ["quotes", "Quote"],
  ["task", "Task"],
  ["meeting", "Meeting"],
  ["phoneCall", "PhoneCall"],
  ["email", "Email"],
  ["text-msg", "TextMsg"],
  ["document", "Document"],
  ["validation", "Validation"],
  ["email-temp", "EmailTemplate"],
  ["modules", "ModuleActiveDeactive"],
  ["bank-details", "BankDetails"],
  ["images", "ImagesSchema"],
  ["role-access", "RoleAccess"],
  ["custom-field", "CustomField"],
  ["lead-followup", "FollowUp"],
]

for (const [path, model] of crudRoutes) app.use(`/api/${path}`, createCrudRouter(model))

app.get("/api/calendar", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const [tasks, meetings, calls] = await Promise.all([
      prisma.task.findMany({ where: { organizationId: req.auth!.organizationId, deleted: false } }),
      prisma.meeting.findMany({ where: { organizationId: req.auth!.organizationId, deleted: false } }),
      prisma.phoneCall.findMany({ where: { organizationId: req.auth!.organizationId, deleted: false } }),
    ])
    const data = [
      ...tasks.map((item) => ({ ...item, eventType: "Task" })),
      ...meetings.map((item) => ({ ...item, title: item.agenda, start: item.dateTime, eventType: "Meeting" })),
      ...calls.map((item) => ({ ...item, title: `${item.sender || "Call"} → ${item.recipient || ""}`, start: item.startDate, eventType: "Call" })),
    ]
    res.json({ data })
  } catch (error) { next(error) }
})

const numericValue = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

app.get("/api/analytics", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const tenant = { organizationId: req.auth!.organizationId, deleted: false }
    const [leads, contacts, properties, opportunities, invoices, tasks] = await Promise.all([
      prisma.lead.findMany({
        where: tenant,
        select: { id: true, leadStatus: true, leadSource: true, createdDate: true },
      }),
      prisma.contact.count({ where: tenant }),
      prisma.property.findMany({
        where: tenant,
        select: { id: true, listingPrice: true, propertyType: true, createdDate: true },
      }),
      prisma.opportunity.findMany({
        where: tenant,
        select: { id: true, stage: true, amount: true, probability: true, createdDate: true },
      }),
      prisma.invoice.findMany({
        where: tenant,
        select: { id: true, status: true, grandTotal: true, createdDate: true },
      }),
      prisma.task.findMany({
        where: tenant,
        select: { id: true, status: true, end: true },
      }),
    ])

    const pipelineStages = ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]
    const pipeline = pipelineStages.map((stage) => {
      const stageRecords = opportunities.filter((item) => {
        const current = String(item.stage || "Prospecting").toLowerCase()
        if (stage === "Closed Won") return current === "closed won" || current === "won"
        if (stage === "Closed Lost") return current === "closed lost" || current === "lost"
        return current === stage.toLowerCase()
      })
      return {
        stage,
        count: stageRecords.length,
        value: stageRecords.reduce((sum, item) => sum + numericValue(item.amount), 0),
      }
    })

    const sourceCounts = new Map<string, number>()
    for (const lead of leads) {
      const source = String(lead.leadSource || "Unspecified").trim() || "Unspecified"
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1)
    }

    const now = new Date()
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      return {
        key: monthKey(date),
        month: new Intl.DateTimeFormat("en", { month: "short" }).format(date),
        leads: 0,
        opportunities: 0,
        revenue: 0,
      }
    })
    const trendByMonth = new Map(months.map((month) => [month.key, month]))
    for (const lead of leads) {
      const bucket = trendByMonth.get(monthKey(lead.createdDate))
      if (bucket) bucket.leads += 1
    }
    for (const opportunity of opportunities) {
      const bucket = trendByMonth.get(monthKey(opportunity.createdDate))
      if (bucket) bucket.opportunities += 1
    }
    for (const invoice of invoices) {
      const bucket = trendByMonth.get(monthKey(invoice.createdDate))
      if (bucket && String(invoice.status).toLowerCase() === "paid") {
        bucket.revenue += numericValue(invoice.grandTotal)
      }
    }

    const qualified = leads.filter((item) =>
      ["qualified", "converted"].includes(String(item.leadStatus || "").toLowerCase()),
    ).length
    const won = pipeline.find((item) => item.stage === "Closed Won")?.count || 0
    const openPipelineValue = pipeline
      .filter((item) => !item.stage.startsWith("Closed"))
      .reduce((sum, item) => sum + item.value, 0)
    const paidRevenue = invoices
      .filter((item) => String(item.status).toLowerCase() === "paid")
      .reduce((sum, item) => sum + numericValue(item.grandTotal), 0)
    const overdueTasks = tasks.filter((item) => {
      if (!item.end || String(item.status).toLowerCase() === "complete") return false
      const due = new Date(item.end)
      return !Number.isNaN(due.getTime()) && due < now
    }).length

    res.json({
      data: {
        kpis: {
          leads: leads.length,
          contacts,
          properties: properties.length,
          opportunities: opportunities.length,
          openPipelineValue,
          paidRevenue,
          overdueTasks,
          conversionRate: leads.length ? Number(((won / leads.length) * 100).toFixed(1)) : 0,
        },
        pipeline,
        leadSources: [...sourceCounts.entries()]
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8),
        monthlyTrend: months.map(({ key: _key, ...month }) => month),
        funnel: [
          { stage: "Leads", value: leads.length },
          { stage: "Qualified", value: qualified },
          { stage: "Opportunities", value: opportunities.length },
          { stage: "Closed won", value: won },
        ],
      },
    })
  } catch (error) { next(error) }
})

app.get("/api/reporting", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const tenant = { organizationId: req.auth!.organizationId, deleted: false }
    const [leads, contacts, properties, opportunities, invoices] = await Promise.all([
      prisma.lead.count({ where: tenant }),
      prisma.contact.count({ where: tenant }),
      prisma.property.count({ where: tenant }),
      prisma.opportunity.count({ where: tenant }),
      prisma.invoice.count({ where: tenant }),
    ])
    res.json({ data: [
      { id: "leads", name: "Leads", value: leads, period: "All time" },
      { id: "contacts", name: "Contacts", value: contacts, period: "All time" },
      { id: "properties", name: "Properties", value: properties, period: "All time" },
      { id: "opportunities", name: "Opportunities", value: opportunities, period: "All time" },
      { id: "invoices", name: "Invoices", value: invoices, period: "All time" },
    ] })
  } catch (error) { next(error) }
})

app.get("/api/payment", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { organizationId: req.auth!.organizationId, deleted: false, status: "Paid" },
      orderBy: { updatedDate: "desc" },
    })
    res.json({
      data: invoices.map((invoice) => ({
        id: invoice.id,
        reference: invoice.invoiceNumber || invoice.title || invoice.id,
        amount: numericValue(invoice.grandTotal),
        account: invoice.account,
        contact: invoice.contact,
        status: "Received",
        createdDate: invoice.updatedDate,
      })),
    })
  } catch (error) { next(error) }
})
app.get("/api/route", requireAuth, (_req, res) => res.json({
  data: [
    { id: "database", name: "Database", value: "Connected through validated environment configuration" },
    { id: "authentication", name: "Authentication", value: "Secure HTTP-only workspace sessions with revocation and role guards" },
    { id: "cors", name: "Allowed web origins", value: `${allowedOrigins.length} configured` },
    { id: "uploads", name: "Maximum JSON request", value: "2 MB" },
    { id: "runtime", name: "API runtime", value: `Express ${process.env.NODE_ENV === "production" ? "production" : "development"}` },
  ],
}))

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error)
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Request validation failed",
      details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    })
    return
  }
  const message = error instanceof Error ? error.message : "Unexpected server error"
  const status = message.includes("Unique constraint") ? 409 : 500
  res.status(status).json({ error: status === 500 ? "The server could not complete the request" : message })
})

export async function startServer() {
  await prisma.$connect()
  const httpServer = createServer(app)
  const io = new SocketServer(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  })
  setSocketServer(io)
  io.use(async (socket, next) => {
    try {
      const request = socket.request as AuthRequest
      await requireAuth(request, {
        status: () => ({
          json: () => {
            throw new Error("Authentication required")
          },
        }),
        clearCookie: () => undefined,
      } as unknown as Response, (error?: unknown) =>
        error ? next(error instanceof Error ? error : new Error("Authentication required")) : next())
    } catch {
      next(new Error("Authentication required"))
    }
  })
  io.on("connection", (socket) => {
    const organizationId = (socket.request as AuthRequest).auth?.organizationId
    if (organizationId) void socket.join(`organization:${organizationId}`)
  })
  startJobWorker()
  return httpServer.listen(env.PORT, () => {
    console.log(`MooNsEstate API listening on http://127.0.0.1:${env.PORT}`)
  })
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    console.error("Failed to start MooNsEstate API", error)
    process.exitCode = 1
  })
}

export default app

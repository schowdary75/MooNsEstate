import prisma from "../db/prisma.js"

const DEFAULT_ORGANIZATION_SLUG = "moon-estates"
const catalogReady = new Set<string>()
const catalogTasks = new Map<string, Promise<void>>()
const roleCatalog = [
  ["platform_owner", "Platform Owner"],
  ["organization_owner", "Organization Owner"],
  ["organization_admin", "Organization Admin"],
  ["sales_manager", "Sales Manager"],
  ["marketing_manager", "Marketing Manager"],
  ["agent", "Agent"],
  ["finance", "Finance"],
  ["read_only", "Read Only"],
] as const

const permissionCatalog = [
  "organization.manage",
  "members.manage",
  "leads.read",
  "leads.write",
  "properties.read",
  "properties.write",
  "inventory.manage",
  "deals.read",
  "deals.write",
  "deals.execute",
  "collections.manage",
  "financials.read",
  "reports.sales",
  "communications.read",
  "communications.send",
  "meta.read",
  "meta.sync",
  "billing.manage",
  "reports.export",
] as const

const permissionsByRole: Record<string, readonly string[]> = {
  platform_owner: permissionCatalog,
  organization_owner: permissionCatalog,
  organization_admin: permissionCatalog.filter((key) => key !== "billing.manage"),
  sales_manager: ["leads.read", "leads.write", "properties.read", "properties.write", "inventory.manage", "deals.read", "deals.write", "deals.execute", "collections.manage", "financials.read", "reports.sales", "communications.read", "communications.send", "meta.read", "reports.export"],
  marketing_manager: ["leads.read", "leads.write", "properties.read", "deals.read", "reports.sales", "communications.read", "communications.send", "meta.read", "meta.sync", "reports.export"],
  agent: ["leads.read", "leads.write", "properties.read", "deals.read", "deals.write", "reports.sales", "communications.read", "communications.send", "meta.read"],
  finance: ["leads.read", "properties.read", "deals.read", "collections.manage", "financials.read", "reports.sales", "billing.manage", "reports.export"],
  read_only: ["leads.read", "properties.read", "communications.read", "meta.read"],
}

export const roleForLegacyUser = (role?: string | null) =>
  role === "superAdmin" ? "organization_owner" : "agent"

export async function ensureRoleCatalog(organizationId: string) {
  const permissions = new Map<string, string>()
  for (const key of permissionCatalog) {
    const permission = await prisma.permission.upsert({
      where: { organizationId_key: { organizationId, key } },
      update: {},
      create: { organizationId, key },
    })
    permissions.set(key, permission.id)
  }
  for (const [name, label] of roleCatalog) {
    const role = await prisma.role.upsert({
      where: { organizationId_name: { organizationId, name } },
      update: { label, system: true },
      create: { organizationId, name, label, system: true },
    })
    for (const key of permissionsByRole[name] || []) {
      const permissionId = permissions.get(key)
      if (!permissionId) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: { organizationId },
        create: { organizationId, roleId: role.id, permissionId },
      })
    }
    await prisma.membership.updateMany({
      where: { organizationId, role: name, roleId: null },
      data: { roleId: role.id },
    })
  }
  catalogReady.add(organizationId)
}

async function ensureRoleCatalogOnce(organizationId: string) {
  if (catalogReady.has(organizationId)) return
  const running = catalogTasks.get(organizationId)
  if (running) return running
  const task = ensureRoleCatalog(organizationId).finally(() => catalogTasks.delete(organizationId))
  catalogTasks.set(organizationId, task)
  return task
}

export async function ensureDefaultWorkspace(userId: string, legacyRole?: string | null) {
  const existing = await prisma.membership.findFirst({
    where: { userId, status: "active" },
    orderBy: { createdDate: "asc" },
  })
  if (existing) {
    await ensureRoleCatalogOnce(existing.organizationId)
    return prisma.membership.findUniqueOrThrow({ where: { id: existing.id } })
  }

  const organization = await prisma.organization.upsert({
    where: { slug: DEFAULT_ORGANIZATION_SLUG },
    update: {},
    create: {
      name: "MooN Estates",
      slug: DEFAULT_ORGANIZATION_SLUG,
      currency: "INR",
      timezone: "Asia/Kolkata",
    },
  })

  const membership = await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId,
      },
    },
    update: { status: "active" },
    create: {
      organizationId: organization.id,
      userId,
      role: roleForLegacyUser(legacyRole),
    },
  })
  await ensureRoleCatalog(organization.id)
  const role = await prisma.role.findUnique({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: membership.role,
      },
    },
  })
  if (role && membership.roleId !== role.id) {
    await prisma.membership.update({ where: { id: membership.id }, data: { roleId: role.id } })
  }

  const starter = await prisma.plan.upsert({
    where: { code: "starter" },
    update: {},
    create: {
      code: "starter",
      name: "Starter",
      description: "For focused real-estate teams starting their digital sales desk.",
      includedSeats: 3,
      includedLeads: 2_500,
      includedMessages: 2_000,
      includedTranscriptionMinutes: 120,
    },
  })
  await prisma.plan.upsert({
    where: { code: "growth" },
    update: {},
    create: {
      code: "growth",
      name: "Growth",
      description: "For brokerages scaling Meta acquisition and omnichannel follow-up.",
      includedSeats: 10,
      includedLeads: 15_000,
      includedStorageMb: 10_240,
      includedMessages: 15_000,
      includedTranscriptionMinutes: 1_000,
    },
  })
  await prisma.plan.upsert({
    where: { code: "enterprise" },
    update: {},
    create: {
      code: "enterprise",
      name: "Enterprise",
      description: "For multi-office organizations requiring custom limits and controls.",
      includedSeats: 50,
      includedLeads: 100_000,
      includedStorageMb: 102_400,
      includedMessages: 100_000,
      includedTranscriptionMinutes: 10_000,
    },
  })

  const subscription = await prisma.subscription.findFirst({
    where: { organizationId: organization.id },
  })
  if (!subscription) {
    const now = new Date()
    const trialEndsAt = new Date(now)
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)
    await prisma.subscription.create({
      data: {
        organizationId: organization.id,
        planId: starter.id,
        provider: "razorpay",
        status: "trialing",
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
      },
    })
  }

  return membership
}

export async function membershipForUser(userId: string, organizationId?: string | null) {
  if (organizationId) {
    const membership = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    })
    if (membership?.status === "active") return membership
  }
  return ensureDefaultWorkspace(userId)
}

export const canManageOrganization = (role?: string | null) =>
  role === "platform_owner" || role === "organization_owner" || role === "organization_admin"

export const canManageSales = (role?: string | null) =>
  canManageOrganization(role) || role === "sales_manager" || role === "marketing_manager"

export const hasSystemPermission = (role: string | null | undefined, permission: string) =>
  Boolean(role && permissionsByRole[role]?.includes(permission))

export const isSystemRole = (role: string | null | undefined) =>
  Boolean(role && role in permissionsByRole)

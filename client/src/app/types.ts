import type { LucideIcon } from "lucide-react"

export type CrmRecord = Record<string, unknown> & {
  id?: string
  _id?: string
  createdDate?: string
  updatedDate?: string
}

export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "url"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "textarea"
  | "select"
  | "boolean"
  | "password"

export type FieldConfig = {
  key: string
  label: string
  type?: FieldType
  required?: boolean
  options?: string[]
  placeholder?: string
  description?: string
  min?: number
  max?: number
  step?: number
  table?: boolean
}

export type ModuleConfig = {
  key: string
  label: string
  singular: string
  path: string
  endpoint: string
  icon: LucideIcon
  group: "Workspace" | "Activity" | "Operations" | "Administration"
  fields: FieldConfig[]
  readOnly?: boolean
  adminOnly?: boolean
  addMany?: boolean
}

export type SessionUser = {
  id?: string
  _id?: string
  username?: string
  firstName?: string
  lastName?: string
  role?: string
  legacyRole?: string
  organizationId?: string
  roles?: unknown
}

export const recordId = (record: CrmRecord) =>
  String(record.id ?? record._id ?? "")

export const displayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.map(displayValue).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export const numericValue = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export const formatFieldValue = (field: FieldConfig, value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—"
  if (field.type === "currency") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numericValue(value))
  }
  if (field.type === "number") return new Intl.NumberFormat("en-IN").format(numericValue(value))
  if (field.type === "boolean") return value === true || value === "true" ? "Yes" : "No"
  if (field.type === "date" || field.type === "datetime") {
    const date = new Date(String(value))
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        ...(field.type === "datetime" ? { timeStyle: "short" as const } : {}),
      }).format(date)
    }
  }
  return displayValue(value)
}

export type AnalyticsData = {
  kpis: {
    leads: number
    contacts: number
    properties: number
    opportunities: number
    openPipelineValue: number
    paidRevenue: number
    overdueTasks: number
    conversionRate: number
  }
  pipeline: Array<{ stage: string; count: number; value: number }>
  leadSources: Array<{ source: string; count: number }>
  monthlyTrend: Array<{ month: string; leads: number; opportunities: number; revenue: number }>
  funnel: Array<{ stage: string; value: number }>
}

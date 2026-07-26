import axios, { AxiosError } from "axios"
import type { AnalyticsData, CrmRecord } from "./types"

const baseURL = import.meta.env.VITE_API_URL || "/api"

export const api = axios.create({
  baseURL,
  timeout: 20_000,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  headers: { "Content-Type": "application/json" },
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const requestUrl = String(error.config?.url || "")
    const optionalSessionRequest = requestUrl.includes("/v1/session")
      || requestUrl.includes("/v1/portal/me")
    if (error.response?.status === 401 && !optionalSessionRequest && !location.pathname.startsWith("/sign-in")) {
      location.assign("/sign-in")
    }
    return Promise.reject(error)
  },
)

export const errorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { error?: string; message?: string } | undefined
    return payload?.error || payload?.message || error.message
  }
  return error instanceof Error ? error.message : "Something went wrong"
}

export const extractRecords = (payload: unknown): CrmRecord[] => {
  if (Array.isArray(payload)) return payload as CrmRecord[]
  if (!payload || typeof payload !== "object") return []
  const object = payload as Record<string, unknown>
  for (const value of Object.values(object)) {
    if (Array.isArray(value)) return value as CrmRecord[]
  }
  if ("id" in object || "_id" in object) return [object as CrmRecord]
  return []
}

export const listRecords = async (endpoint: string) => {
  const response = await api.get(`/${endpoint}`)
  return extractRecords(response.data)
}

export const createRecord = async (endpoint: string, data: Record<string, unknown>) => {
  const response = await api.post(`/${endpoint}/add`, data)
  return response.data
}

export const updateRecord = async (endpoint: string, id: string, data: Record<string, unknown>) => {
  const response = await api.put(`/${endpoint}/edit/${id}`, data)
  return response.data
}

export const deleteRecord = async (endpoint: string, id: string) => {
  const response = await api.delete(`/${endpoint}/delete/${id}`)
  return response.data
}

export const deleteRecords = async (endpoint: string, ids: string[]) => {
  const response = await api.post(`/${endpoint}/deleteMany`, ids)
  return response.data
}

export const importRecords = async (endpoint: string, data: Record<string, unknown>[]) => {
  const response = await api.post(`/${endpoint}/addMany`, data)
  return response.data
}

export const getAnalytics = async () => {
  const response = await api.get<{ data: AnalyticsData }>("/analytics")
  return response.data.data
}

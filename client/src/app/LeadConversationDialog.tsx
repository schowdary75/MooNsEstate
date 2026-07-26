import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock3,
  Mail,
  MessageCircle,
  Mic2,
  PhoneCall,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react"
import { io } from "socket.io-client"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api, errorMessage } from "./api"
import type { CrmRecord } from "./types"
import { recordId } from "./types"

type Channel = "whatsapp" | "email"

type Conversation = {
  id: string
  channel: Channel
  subject?: string | null
  unreadCount: number
  customerWindowEndsAt?: string | null
  assignedTo?: string | null
}

type Message = {
  id: string
  direction: "inbound" | "outbound" | "internal"
  type: string
  text?: string | null
  html?: string | null
  status: string
  errorMessage?: string | null
  templateName?: string | null
  createdDate: string
}

type Call = {
  id: string
  status: string
  direction: string
  fromNumber?: string | null
  toNumber?: string | null
  durationSeconds?: number | null
  consentedToRecording: boolean
  createdDate: string
  recording?: { id: string; retentionUntil?: string | null } | null
  transcript?: { status: string; text?: string | null; languageCode?: string | null } | null
}

type Attribution = {
  submission?: {
    externalId: string
    submittedAt?: string | null
    fieldData?: unknown
    status: string
  } | null
  campaign?: { name: string; externalId: string; status?: string | null } | null
  adSet?: { name: string; externalId: string; status?: string | null } | null
  ad?: { name: string; externalId: string; previewUrl?: string | null; status?: string | null } | null
  form?: { name: string; externalId: string } | null
  touches?: Array<{ id: string; source: string; occurredAt: string }>
}

const messageStatus = (status: string) => {
  if (status === "read") return <CheckCheck className="size-3 text-blue-500" aria-label="Read" />
  if (status === "delivered") return <CheckCheck className="size-3" aria-label="Delivered" />
  if (status === "sent") return <Check className="size-3" aria-label="Sent" />
  if (status === "failed") return <AlertCircle className="size-3 text-red-500" aria-label="Failed" />
  return <Clock3 className="size-3" aria-label={status} />
}

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"

const socketOrigin = () => {
  const configured = import.meta.env.VITE_API_URL
  if (!configured || configured.startsWith("/")) return window.location.origin
  try {
    return new URL(configured).origin
  } catch {
    return window.location.origin
  }
}

export function LeadConversationDialog({
  lead,
  open,
  onOpenChange,
  initialTab = "whatsapp",
}: {
  lead: CrmRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: "overview" | "whatsapp" | "email" | "calls" | "meta"
}) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(initialTab)
  const [message, setMessage] = useState("")
  const [subject, setSubject] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [internalNote, setInternalNote] = useState(false)
  const [agentNumber, setAgentNumber] = useState("")
  const [recordingConsent, setRecordingConsent] = useState(false)
  const messagesEnd = useRef<HTMLDivElement>(null)
  const leadId = lead ? recordId(lead) : ""

  useEffect(() => setTab(initialTab), [initialTab, leadId])

  const conversationQuery = useQuery<Conversation>({
    queryKey: ["lead-conversation", leadId, tab],
    enabled: open && Boolean(leadId) && (tab === "whatsapp" || tab === "email"),
    queryFn: async () => {
      const response = await api.post(`/v1/leads/${leadId}/conversations`, { channel: tab })
      return response.data.data
    },
  })

  const messagesQuery = useQuery<Message[]>({
    queryKey: ["conversation-messages", conversationQuery.data?.id],
    enabled: open && Boolean(conversationQuery.data?.id),
    refetchInterval: 15_000,
    queryFn: async () => {
      const response = await api.get(`/v1/conversations/${conversationQuery.data!.id}/messages?limit=100`)
      return response.data.data
    },
  })

  const callsQuery = useQuery<Call[]>({
    queryKey: ["lead-calls", leadId],
    enabled: open && Boolean(leadId) && tab === "calls",
    queryFn: async () => {
      const response = await api.get(`/v1/leads/${leadId}/calls`)
      return response.data.data
    },
  })

  const attributionQuery = useQuery<Attribution>({
    queryKey: ["lead-meta", leadId],
    enabled: open && Boolean(leadId) && tab === "meta",
    queryFn: async () => {
      const response = await api.get(`/v1/leads/${leadId}/meta-attribution`)
      return response.data.data
    },
  })

  const integrationsQuery = useQuery<Array<{ provider: string; status: string }>>({
    queryKey: ["integrations"],
    enabled: open,
    queryFn: async () => {
      const response = await api.get("/v1/integrations")
      return response.data.data
    },
  })

  useEffect(() => {
    if (!open) return
    const socket = io(socketOrigin(), { withCredentials: true })
    socket.on("conversation.message", (event: { conversationId?: string; leadId?: string }) => {
      if (event.leadId !== leadId && event.conversationId !== conversationQuery.data?.id) return
      void queryClient.invalidateQueries({ queryKey: ["conversation-messages", event.conversationId] })
      void queryClient.invalidateQueries({ queryKey: ["conversations"] })
    })
    return () => {
      socket.close()
    }
  }, [open, leadId, conversationQuery.data?.id, queryClient])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ block: "end" })
  }, [messagesQuery.data])

  useEffect(() => {
    if (conversationQuery.data?.unreadCount) {
      void api.post(`/v1/conversations/${conversationQuery.data.id}/read`)
    }
  }, [conversationQuery.data?.id, conversationQuery.data?.unreadCount])

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!conversationQuery.data) throw new Error("Conversation is still loading")
      if (!message.trim() && !templateName.trim()) throw new Error("Write a message or choose a template")
      return api.post(`/v1/conversations/${conversationQuery.data.id}/messages`, {
        text: message.trim() || undefined,
        subject: tab === "email" ? subject.trim() || undefined : undefined,
        templateName: tab === "whatsapp" ? templateName.trim() || undefined : undefined,
        templateLanguage: "en_US",
        internalNote,
      })
    },
    onSuccess: () => {
      setMessage("")
      setTemplateName("")
      setInternalNote(false)
      void messagesQuery.refetch()
      toast.success(internalNote ? "Internal note added" : "Message sent to provider")
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const callMutation = useMutation({
    mutationFn: async () => {
      if (!agentNumber.trim()) throw new Error("Enter the agent’s callback number")
      return api.post(`/v1/leads/${leadId}/calls`, {
        agentNumber,
        consentedToRecording: recordingConsent,
      })
    },
    onSuccess: () => {
      toast.success("Exotel call request queued")
      void callsQuery.refetch()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const providerStatus = useMemo(() => {
    const provider = tab === "whatsapp" || tab === "meta"
      ? "meta"
      : tab === "email"
        ? "resend"
        : tab === "calls"
          ? "exotel"
          : ""
    return integrationsQuery.data?.find((item) => item.provider === provider)?.status || "setup_required"
  }, [integrationsQuery.data, tab])

  const whatsappWindowOpen = conversationQuery.data?.customerWindowEndsAt
    ? new Date(conversationQuery.data.customerWindowEndsAt) > new Date()
    : false

  const messages = messagesQuery.data || []
  const meta = attributionQuery.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[92vh] sm:w-[min(1180px,95vw)] sm:max-w-[1180px] sm:rounded-2xl">
        <DialogHeader className="border-b bg-white px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="text-xl">{String(lead?.leadName || "Lead workspace")}</DialogTitle>
              <DialogDescription>
                {String(lead?.leadPhoneNumber || "No phone")} · {String(lead?.leadEmail || "No email")}
              </DialogDescription>
            </div>
            <Badge variant="outline" className={providerStatus === "configured" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
              {providerStatus === "configured" ? <ShieldCheck className="mr-1 size-3" /> : <AlertCircle className="mr-1 size-3" />}
              {providerStatus === "configured" ? "Provider connected" : "Setup required"}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="flex min-h-0 flex-1 flex-col">
          <div className="overflow-x-auto border-b bg-slate-50 px-4">
            <TabsList className="h-12 w-max bg-transparent p-0">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="whatsapp"><MessageCircle className="size-4" /> WhatsApp</TabsTrigger>
              <TabsTrigger value="email"><Mail className="size-4" /> Email</TabsTrigger>
              <TabsTrigger value="calls"><PhoneCall className="size-4" /> Calls</TabsTrigger>
              <TabsTrigger value="meta">Meta Attribution</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="m-0 flex-1 overflow-y-auto p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <section className="rounded-2xl border bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead status</p>
                <p className="mt-2 text-2xl font-semibold">{String(lead?.leadStatus || "New")}</p>
                <p className="mt-1 text-sm text-muted-foreground">Priority: {String(lead?.priority || "Medium")}</p>
              </section>
              <section className="rounded-2xl border bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acquisition source</p>
                <p className="mt-2 text-2xl font-semibold">{String(lead?.leadSource || "Unknown")}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{String(lead?.metaLeadId || "No Meta lead ID")}</p>
              </section>
              <section className="rounded-2xl border bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next follow-up</p>
                <p className="mt-2 text-lg font-semibold">{formatDate(lead?.nextFollowUpDate as string | undefined)}</p>
              </section>
              <section className="rounded-2xl border bg-slate-50 p-4 md:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes and requirements</p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{String(lead?.notes || lead?.leadAddress || "No notes yet.")}</p>
              </section>
            </div>
          </TabsContent>

          {(["whatsapp", "email"] as Channel[]).map((channel) => (
            <TabsContent key={channel} value={channel} className="m-0 flex min-h-0 flex-1 flex-col">
              {channel === "whatsapp" && (
                <div className={`border-b px-5 py-2 text-xs ${whatsappWindowOpen ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                  {whatsappWindowOpen
                    ? `Customer-service window open until ${formatDate(conversationQuery.data?.customerWindowEndsAt)}.`
                    : "The 24-hour window is closed. Use an approved Meta template to contact this lead."}
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f3ef] px-4 py-5 sm:px-8">
                {conversationQuery.isLoading || messagesQuery.isLoading ? (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading conversation…</div>
                ) : messages.length === 0 ? (
                  <div className="grid h-full place-items-center text-center">
                    <div>
                      <MessageCircle className="mx-auto size-10 text-muted-foreground" />
                      <p className="mt-3 font-semibold">No messages yet</p>
                      <p className="text-sm text-muted-foreground">Start the conversation from this verified CRM thread.</p>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl space-y-3">
                    {messages.map((item) => (
                      <div
                        key={item.id}
                        className={`flex ${item.direction === "outbound" ? "justify-end" : item.direction === "internal" ? "justify-center" : "justify-start"}`}
                      >
                        <article className={`max-w-[85%] rounded-2xl border px-4 py-2.5 shadow-sm ${
                          item.direction === "outbound"
                            ? "rounded-br-sm border-emerald-200 bg-emerald-50"
                            : item.direction === "internal"
                              ? "border-amber-200 bg-amber-50 text-amber-950"
                              : "rounded-bl-sm bg-white"
                        }`}>
                          {item.direction === "internal" && <p className="mb-1 text-[10px] font-bold uppercase tracking-wide">Internal note</p>}
                          {item.templateName && <Badge variant="secondary" className="mb-1">Template: {item.templateName}</Badge>}
                          <p className="whitespace-pre-wrap break-words text-sm">{item.text || "Rich email message"}</p>
                          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                            {formatDate(item.createdDate)}
                            {item.direction === "outbound" && messageStatus(item.status)}
                          </div>
                          {item.errorMessage && <p className="mt-1 text-xs text-red-600">{item.errorMessage}</p>}
                        </article>
                      </div>
                    ))}
                    <div ref={messagesEnd} />
                  </div>
                )}
              </div>
              <div className="border-t bg-white p-4">
                <div className="mx-auto max-w-3xl space-y-3">
                  {channel === "email" && (
                    <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Email subject" />
                  )}
                  {channel === "whatsapp" && !whatsappWindowOpen && (
                    <Input
                      value={templateName}
                      onChange={(event) => setTemplateName(event.target.value)}
                      placeholder="Approved Meta template name (required outside 24 hours)"
                    />
                  )}
                  <Textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={internalNote ? "Write a note visible only to your team…" : `Write a ${channel === "email" ? "lead email" : "WhatsApp message"}…`}
                    rows={3}
                    onKeyDown={(event) => {
                      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") sendMutation.mutate()
                    }}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Label className="flex items-center gap-2 text-xs">
                      <Checkbox checked={internalNote} onCheckedChange={(value) => setInternalNote(Boolean(value))} />
                      Internal note
                    </Label>
                    <Button
                      onClick={() => sendMutation.mutate()}
                      disabled={sendMutation.isPending || providerStatus !== "configured" && !internalNote}
                    >
                      <Send className="size-4" />
                      {sendMutation.isPending ? "Sending…" : internalNote ? "Add note" : "Send"}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}

          <TabsContent value="calls" className="m-0 min-h-0 flex-1 overflow-y-auto p-5">
            <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
              <section className="h-fit space-y-4 rounded-2xl border bg-white p-4">
                <div>
                  <h3 className="font-semibold">Exotel click-to-call</h3>
                  <p className="text-xs text-muted-foreground">Exotel first calls the agent, then securely connects the customer.</p>
                </div>
                <div>
                  <Label htmlFor="agent-number">Agent callback number</Label>
                  <Input id="agent-number" value={agentNumber} onChange={(event) => setAgentNumber(event.target.value)} placeholder="+91 98765 43210" />
                </div>
                <Label className="flex items-start gap-2 rounded-xl border p-3 text-xs">
                  <Checkbox checked={recordingConsent} onCheckedChange={(value) => setRecordingConsent(Boolean(value))} />
                  <span>Customer consented to recording. Without consent, the call proceeds without recording.</span>
                </Label>
                <Button className="w-full" disabled={callMutation.isPending || providerStatus !== "configured"} onClick={() => callMutation.mutate()}>
                  <PhoneCall className="size-4" />
                  {callMutation.isPending ? "Connecting…" : "Start secure call"}
                </Button>
              </section>
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Call history</h3>
                  <Button variant="ghost" size="sm" onClick={() => callsQuery.refetch()}><RefreshCw className="size-4" /> Refresh</Button>
                </div>
                {(callsQuery.data || []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">No provider calls recorded for this lead.</div>
                ) : (callsQuery.data || []).map((call) => (
                  <article key={call.id} className="rounded-2xl border bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold capitalize">{call.direction} call · {call.status}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(call.createdDate)} · {call.durationSeconds || 0}s</p>
                      </div>
                      <Badge variant="outline">{call.consentedToRecording ? "Recording consented" : "Not recorded"}</Badge>
                    </div>
                    {call.transcript && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3">
                        <p className="mb-1 flex items-center gap-1 text-xs font-semibold"><Mic2 className="size-3" /> Transcript · {call.transcript.status}</p>
                        <p className="whitespace-pre-wrap text-sm">{call.transcript.text || "Transcription is being processed."}</p>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            </div>
          </TabsContent>

          <TabsContent value="meta" className="m-0 min-h-0 flex-1 overflow-y-auto p-5">
            {attributionQuery.isLoading ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading Meta attribution…</div>
            ) : !meta?.submission ? (
              <div className="rounded-2xl border border-dashed p-12 text-center">
                <p className="font-semibold">No Meta submission attached</p>
                <p className="text-sm text-muted-foreground">Direct, referral, and organic leads correctly remain unattributed.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-4">
                  {[
                    ["Campaign", meta.campaign?.name || "Unknown", meta.campaign?.externalId],
                    ["Ad set", meta.adSet?.name || "Unknown", meta.adSet?.externalId],
                    ["Ad", meta.ad?.name || "Unknown", meta.ad?.externalId],
                    ["Lead form", meta.form?.name || "Unknown", meta.form?.externalId],
                  ].map(([label, value, id]) => (
                    <section key={label} className="rounded-2xl border bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="mt-2 font-semibold">{value}</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{id || "No provider ID"}</p>
                    </section>
                  ))}
                </div>
                <section className="rounded-2xl border bg-white p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meta Lead ID</p>
                      <p className="font-mono text-sm">{meta.submission.externalId}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold capitalize">{meta.submission.status}</p>
                      <p className="text-muted-foreground">{formatDate(meta.submission.submittedAt)}</p>
                    </div>
                  </div>
                  <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                    {JSON.stringify(meta.submission.fieldData || {}, null, 2)}
                  </pre>
                </section>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

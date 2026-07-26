import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { Clock3, Mail, MessageCircle, Search, SlidersHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "./api"
import { LeadConversationDialog } from "./LeadConversationDialog"
import type { CrmRecord } from "./types"

type Conversation = {
  id: string
  channel: "whatsapp" | "email"
  subject?: string | null
  status: string
  priority: string
  unreadCount: number
  lastMessageAt?: string | null
  customerWindowEndsAt?: string | null
  lead: CrmRecord | null
}

export function ConversationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [channel, setChannel] = useState("all")
  const [status, setStatus] = useState("open")
  const [query, setQuery] = useState("")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [selected, setSelected] = useState<Conversation | null>(null)

  const conversations = useQuery<Conversation[]>({
    queryKey: ["conversations", channel, status, unreadOnly],
    refetchInterval: 15_000,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (channel !== "all") params.set("channel", channel)
      if (status !== "all") params.set("status", status)
      if (unreadOnly) params.set("unread", "true")
      const response = await api.get(`/v1/conversations?${params.toString()}`)
      return response.data.data
    },
  })

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return conversations.data || []
    return (conversations.data || []).filter((item) =>
      [item.lead?.leadName, item.lead?.leadEmail, item.lead?.leadPhoneNumber, item.subject]
        .some((value) => String(value || "").toLowerCase().includes(search)),
    )
  }, [conversations.data, query])

  useEffect(() => {
    const conversationId = searchParams.get("conversation")
    if (!conversationId || selected?.id === conversationId) return
    const conversation = conversations.data?.find((item) => item.id === conversationId)
    if (conversation) setSelected(conversation)
  }, [conversations.data, searchParams, selected?.id])

  const openConversation = (conversation: Conversation) => {
    setSelected(conversation)
    setSearchParams({ conversation: conversation.id })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Unified Inbox</p>
          <h1 className="font-display text-3xl font-bold">Customer conversations</h1>
          <p className="mt-1 text-sm text-muted-foreground">WhatsApp and email history stay mapped to the correct lead and owner.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, email…" className="pl-9" />
          </div>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={unreadOnly ? "default" : "outline"} onClick={() => setUnreadOnly((value) => !value)}>
            <SlidersHorizontal className="size-4" /> Unread
          </Button>
        </div>
      </header>

      <div className="grid gap-3">
        {conversations.isLoading ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">Loading inbox…</Card>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed p-12 text-center">
            <MessageCircle className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-semibold">No conversations match these filters</p>
            <p className="text-sm text-muted-foreground">Open a lead and start WhatsApp or email to create its verified thread.</p>
          </Card>
        ) : filtered.map((item) => {
          const whatsappOpen = item.customerWindowEndsAt
            ? new Date(item.customerWindowEndsAt) > new Date()
            : false
          return (
            <button
              key={item.id}
              className="grid w-full gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-md md:grid-cols-[auto_1fr_auto]"
              onClick={() => openConversation(item)}
            >
              <div className={`grid size-11 place-items-center rounded-xl ${item.channel === "whatsapp" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                {item.channel === "whatsapp" ? <MessageCircle className="size-5" /> : <Mail className="size-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{String(item.lead?.leadName || "Unmatched customer")}</p>
                  {item.unreadCount > 0 && <Badge>{item.unreadCount} unread</Badge>}
                  <Badge variant="outline" className="capitalize">{item.priority}</Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {String(item.lead?.leadPhoneNumber || item.lead?.leadEmail || item.subject || "No contact identifier")}
                </p>
              </div>
              <div className="text-left text-xs text-muted-foreground md:text-right">
                <p>{item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString("en-IN") : "No messages yet"}</p>
                {item.channel === "whatsapp" && (
                  <p className={`mt-1 flex items-center gap-1 md:justify-end ${whatsappOpen ? "text-emerald-700" : "text-amber-700"}`}>
                    <Clock3 className="size-3" /> {whatsappOpen ? "24h window open" : "Template required"}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <LeadConversationDialog
        lead={selected?.lead || null}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
            setSearchParams({})
          }
        }}
        initialTab={selected?.channel || "whatsapp"}
      />
    </div>
  )
}

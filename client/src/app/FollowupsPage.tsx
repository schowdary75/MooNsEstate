import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  Quote,
  RefreshCw,
  Bot,
  Search,
  Sparkles,
  Trash2,
  Workflow,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { api, errorMessage, listRecords } from "./api"
import { LeadConversationDialog } from "./LeadConversationDialog"
import type { CrmRecord } from "./types"
import { recordId } from "./types"

type AutomationSequence = CrmRecord & {
  activeEnrollments?: number
  description?: string
  steps?: Array<{ channel: string }>
}

const TYPE_ICONS: Record<string, any> = {
  call: Phone,
  site_visit: MapPin,
  whatsapp: MessageSquare,
  email: Mail,
  meeting: CalendarDays,
  quote: Quote,
  other: MessageCircle,
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "border-l-rose-500 bg-rose-50/20",
  high: "border-l-amber-500 bg-amber-50/20",
  medium: "border-l-blue-500 bg-blue-50/20",
  low: "border-l-zinc-300 bg-zinc-50/20",
}

export function FollowupsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

  // Modal states
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [completeItem, setCompleteItem] = useState<CrmRecord | null>(null)
  const [scriptItem, setScriptItem] = useState<CrmRecord | null>(null)
  const [conversationLead, setConversationLead] = useState<CrmRecord | null>(null)
  const [selectedSequence, setSelectedSequence] = useState<AutomationSequence | null>(null)
  const [sequenceLeadId, setSequenceLeadId] = useState("")

  // Form states for schedule
  const [leadId, setLeadId] = useState("")
  const [followUpType, setFollowUpType] = useState("call")
  const [followUpDate, setFollowUpDate] = useState("")
  const [priority, setPriority] = useState("medium")
  const [notes, setNotes] = useState("")

  // Complete Form states
  const [outcome, setOutcome] = useState("")
  const [newLeadStatus, setNewLeadStatus] = useState("")

  // Suggested script state
  const [scriptText, setScriptText] = useState<string | null>(null)
  const [scriptLoading, setScriptLoading] = useState(false)

  // Fetch followups
  const { data: followups = [], isLoading, refetch } = useQuery<CrmRecord[]>({
    queryKey: ["followups"],
    queryFn: async () => {
      const response = await api.get<{ data: CrmRecord[] }>("/v1/followups")
      return response.data.data
    },
  })

  // Fetch leads for select dropdown
  const { data: leads = [] } = useQuery<CrmRecord[]>({
    queryKey: ["records", "lead"],
    queryFn: async () => {
      const res = await listRecords("lead")
      return Array.isArray(res) ? res : []
    },
  })

  const { data: sequences = [] } = useQuery<AutomationSequence[]>({
    queryKey: ["automation-sequences"],
    queryFn: async () => {
      const response = await api.get<{ data: AutomationSequence[] }>("/v1/automation-sequences", {
        params: { status: "active" },
      })
      return response.data.data
    },
  })

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSequence || !sequenceLeadId) throw new Error("Select a lead for this sequence")
      const response = await api.post(
        `/v1/automation-sequences/${recordId(selectedSequence)}/enroll`,
        { leadId: sequenceLeadId },
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] })
      queryClient.invalidateQueries({ queryKey: ["automation-sequences"] })
      setSelectedSequence(null)
      setSequenceLeadId("")
      toast.success("Automation enrolled and follow-ups scheduled")
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  // KPIs
  const stats = useMemo(() => {
    const now = new Date()
    let pending = 0
    let overdue = 0
    let today = 0
    let completed = 0

    followups.forEach((item) => {
      const fDate = item.followUpDate ? new Date(item.followUpDate as string) : null
      if (item.status === "completed") {
        completed++
      } else if (item.status === "cancelled") {
        // skip
      } else {
        pending++
        if (fDate && fDate < now && item.status !== "completed") {
          overdue++
        }
        if (
          fDate &&
          fDate.getFullYear() === now.getFullYear() &&
          fDate.getMonth() === now.getMonth() &&
          fDate.getDate() === now.getDate()
        ) {
          today++
        }
      }
    })

    return { pending, overdue, today, completed }
  }, [followups])

  // Filtered list
  const filtered = useMemo(() => {
    const now = new Date()
    return followups.filter((item) => {
      if (statusFilter === "pending" && item.status !== "pending" && item.status !== "overdue") return false
      if (statusFilter === "completed" && item.status !== "completed") return false
      if (statusFilter === "overdue") {
        const fDate = item.followUpDate ? new Date(item.followUpDate as string) : null
        if (item.status === "completed" || item.status === "cancelled" || !fDate || fDate >= now) return false
      }
      if (statusFilter === "today") {
        const fDate = item.followUpDate ? new Date(item.followUpDate as string) : null
        if (
          !fDate ||
          fDate.getFullYear() !== now.getFullYear() ||
          fDate.getMonth() !== now.getMonth() ||
          fDate.getDate() !== now.getDate()
        ) return false
      }

      if (typeFilter !== "all" && item.followUpType !== typeFilter) return false
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false

      if (search.trim()) {
        const q = search.toLowerCase()
        const leadObj = item.lead && typeof item.lead === "object"
          ? item.lead as CrmRecord
          : typeof item.leadId === "object"
            ? item.leadId as CrmRecord
            : leads.find((lead) => recordId(lead) === String(item.leadId))
        const leadName = (leadObj?.leadName as string) || ""
        const itemNotes = (item.notes as string) || ""
        const itemOutcome = (item.outcome as string) || ""
        if (!leadName.toLowerCase().includes(q) && !itemNotes.toLowerCase().includes(q) && !itemOutcome.toLowerCase().includes(q)) {
          return false
        }
      }

      return true
    })
  }, [followups, leads, statusFilter, typeFilter, priorityFilter, search])

  // Create Followup Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!leadId || !followUpDate) throw new Error("Please select a lead and date")
      const response = await api.post("/v1/followups", {
        leadId,
        followUpType,
        followUpDate,
        priority,
        notes,
        status: "pending",
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] })
      toast.success("Follow-up scheduled!")
      setScheduleOpen(false)
      setLeadId("")
      setFollowUpDate("")
      setNotes("")
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  // Complete Followup Mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!completeItem) return
      const id = recordId(completeItem)
      const response = await api.patch(`/v1/followups/${id}`, {
        status: "completed",
        outcome: outcome || "Follow-up completed.",
        completedAt: new Date().toISOString(),
        leadStatus: newLeadStatus || undefined,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] })
      queryClient.invalidateQueries({ queryKey: ["records", "lead"] })
      toast.success("Follow-up completed!")
      setCompleteItem(null)
      setOutcome("")
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  // Cancel Followup Mutation
  const cancelMutation = useMutation({
    mutationFn: async (item: CrmRecord) => {
      const id = recordId(item)
      const response = await api.patch(`/v1/followups/${id}`, { status: "cancelled" })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] })
      toast.success("Follow-up cancelled")
    },
  })

  // Delete Followup Mutation
  const deleteMutation = useMutation({
    mutationFn: async (item: CrmRecord) => {
      const id = recordId(item)
      const response = await api.delete(`/v1/followups/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] })
      toast.success("Follow-up deleted")
    },
  })

  // Server-backed workspace script
  const handleGenerateScript = async (item: CrmRecord) => {
    setScriptItem(item)
    setScriptLoading(true)
    setScriptText(null)

    try {
      const response = await api.get<{ data: { script: string } }>(
        `/v1/followups/${recordId(item)}/script`,
      )
      setScriptText(response.data.data.script)
    } catch (error) {
      setScriptItem(null)
      toast.error(errorMessage(error))
    } finally {
      setScriptLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Follow-Ups</h1>
          <p className="text-sm text-muted-foreground">
            Schedule, track, and close real estate lead communications with reminders and guided scripts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button onClick={() => setScheduleOpen(true)} className="gap-2 bg-black text-white hover:bg-black/90">
            <Plus className="size-4" />
            Schedule Follow-Up
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending Follow-Ups</CardTitle>
            <Clock className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Active follow-ups queued</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-rose-600">Overdue Follow-Ups</CardTitle>
            <Clock className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scheduled Today</CardTitle>
            <CalendarDays className="size-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
            <p className="text-xs text-muted-foreground">Due for today's cadence</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Completed</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Resolved lead interactions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-black text-white">
              <Workflow className="size-4" />
            </div>
            <div>
              <CardTitle>Follow-up sequences</CardTitle>
              <CardDescription>
                Enrolling a lead schedules visible follow-ups. Messages and calls still require valid consent and configured providers.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sequences.map((sequence) => (
            <div key={recordId(sequence)} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{sequence.name as string}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{sequence.description}</p>
                </div>
                <Badge variant="secondary">{sequence.steps?.length || 0} steps</Badge>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{sequence.activeEnrollments || 0} active</span>
                <Button size="sm" variant="outline" onClick={() => setSelectedSequence(sequence)}>
                  Enroll lead
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Filter Controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search lead or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="today">Scheduled Today</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Follow-Up Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="call">Phone Call</SelectItem>
                <SelectItem value="site_visit">Site Visit</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="quote">Send Quote</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Follow-Ups Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No follow-ups match your criteria.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const TypeIcon = TYPE_ICONS[(item.followUpType as string) || "call"] || MessageCircle
            const isCompleted = item.status === "completed"
            const isOverdue = item.status === "overdue" || (item.status === "pending" && item.followUpDate && new Date(item.followUpDate as string) < new Date())
            const borderStyle = PRIORITY_STYLES[(item.priority as string) || "medium"]

            const leadObj = item.lead && typeof item.lead === "object"
              ? item.lead as CrmRecord
              : typeof item.leadId === "object"
                ? item.leadId as CrmRecord
                : leads.find((lead) => recordId(lead) === String(item.leadId))
            const leadName = (leadObj?.leadName as string) || "Lead Record"
            const leadPhone = (leadObj?.leadPhoneNumber as string) || ""

            return (
              <Card key={recordId(item)} className={`border-l-4 shadow-sm transition-all hover:shadow-md ${borderStyle}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-full bg-black/5">
                        <TypeIcon className="size-4 text-black" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{leadName}</CardTitle>
                        <CardDescription className="text-xs">{leadPhone || "No phone listed"}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={isCompleted ? "default" : isOverdue ? "destructive" : "secondary"}>
                      {isCompleted ? "COMPLETED" : isOverdue ? "OVERDUE" : ((item.priority as string) || "MEDIUM").toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <div className="rounded-lg bg-black/5 p-2 text-xs">
                    <span className="font-semibold text-muted-foreground">SCHEDULED: </span>
                    <span className="font-medium">
                      {item.followUpDate ? new Date(item.followUpDate as string).toLocaleString() : "Not set"}
                    </span>
                  </div>

                  {item.notes && (
                    <div className="text-xs">
                      <p className="font-semibold text-muted-foreground">NOTES:</p>
                      <p className="line-clamp-2 text-black/80">{item.notes as string}</p>
                    </div>
                  )}

                  {item.outcome && (
                    <div className="rounded-md bg-emerald-50 p-2 text-xs border border-emerald-200 text-emerald-900">
                      <p className="font-semibold">OUTCOME:</p>
                      <p>{item.outcome as string}</p>
                    </div>
                  )}

                  {/* Card Actions */}
                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <div className="flex items-center gap-1">
                      {leadPhone && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-emerald-600 gap-1"
                          title="WhatsApp Lead"
                          onClick={() => setConversationLead(leadObj || null)}
                        >
                          <ExternalLink className="size-3.5" /> WhatsApp
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {!isCompleted && item.status !== "cancelled" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 text-xs"
                            onClick={() => void handleGenerateScript(item)}
                          >
                            <Sparkles className="size-3" />
                            Script
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                            onClick={() => {
                              setCompleteItem(item)
                              setOutcome("")
                            }}
                          >
                            <CheckCircle2 className="mr-1 size-3" />
                            Complete
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-amber-600"
                            title="Cancel Follow-Up"
                            onClick={() => cancelMutation.mutate(item)}
                          >
                            <XCircle className="size-3.5" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-rose-600"
                        title="Delete"
                        onClick={() => deleteMutation.mutate(item)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={Boolean(selectedSequence)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSequence(null)
            setSequenceLeadId("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll in {selectedSequence?.name as string}</DialogTitle>
            <DialogDescription>
              Every step becomes a scheduled follow-up with an automation audit reference.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Lead</Label>
            <Select value={sequenceLeadId} onValueChange={setSequenceLeadId}>
              <SelectTrigger><SelectValue placeholder="Choose lead…" /></SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={recordId(lead)} value={recordId(lead)}>
                    {String(lead.leadName || lead.leadEmail || "Unnamed lead")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSequence(null)}>Cancel</Button>
            <Button
              disabled={!sequenceLeadId || enrollMutation.isPending}
              onClick={() => enrollMutation.mutate()}
            >
              {enrollMutation.isPending ? "Scheduling…" : "Schedule sequence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(scriptItem)}
        onOpenChange={(open) => {
          if (!open) {
            setScriptItem(null)
            setScriptText(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="size-5" />
              Suggested conversation guide
            </DialogTitle>
            <DialogDescription>
              Generated from saved lead and follow-up context using a transparent workspace template.
            </DialogDescription>
          </DialogHeader>
          {scriptLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="whitespace-pre-wrap rounded-xl border bg-muted/30 p-4 text-sm leading-6">
              {scriptText}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScriptItem(null)}>Close</Button>
            <Button
              disabled={!scriptText}
              onClick={async () => {
                if (!scriptText) return
                await navigator.clipboard.writeText(scriptText)
                toast.success("Script copied")
              }}
            >
              Copy script
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Follow-Up Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Lead Follow-Up</DialogTitle>
            <DialogDescription>Add a new follow-up task for real estate lead management.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1 block">Select Lead *</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose lead..." />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={recordId(l)} value={recordId(l)}>
                      {(l.leadName as string) || "Lead"} ({(l.leadPhoneNumber as string) || (l.leadEmail as string) || "No Contact"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Type</Label>
                <Select value={followUpType} onValueChange={setFollowUpType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Phone Call</SelectItem>
                    <SelectItem value="site_visit">Site Visit</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="quote">Send Quote</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1 block">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-1 block">Date & Time *</Label>
              <Input
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-1 block">Objective / Notes</Label>
              <Textarea
                placeholder="E.g., Share floor plan, discuss budget, schedule property visit..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-black text-white hover:bg-black/90"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Scheduling..." : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Follow-Up Dialog */}
      <Dialog open={!!completeItem} onOpenChange={(open) => !open && setCompleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Follow-Up Complete</DialogTitle>
            <DialogDescription>Record outcome details and update lead status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1 block">Outcome / Resolution Summary *</Label>
              <Textarea
                placeholder="E.g., Client visited site, loved the 3BHK layout, requested loan documents."
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                rows={4}
              />
            </div>

            <div>
              <Label className="mb-1 block">Update Lead Status (Optional)</Label>
              <Select value={newLeadStatus} onValueChange={setNewLeadStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Keep current status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Contacted">Contacted</SelectItem>
                  <SelectItem value="Qualified">Qualified</SelectItem>
                  <SelectItem value="Offer Made">Offer Made</SelectItem>
                  <SelectItem value="Converted">Converted</SelectItem>
                  <SelectItem value="Closed Lost">Closed Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteItem(null)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? "Saving..." : "Complete Follow-Up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LeadConversationDialog
        lead={conversationLead}
        open={Boolean(conversationLead)}
        onOpenChange={(open) => {
          if (!open) setConversationLead(null)
        }}
        initialTab="whatsapp"
      />
    </div>
  )
}

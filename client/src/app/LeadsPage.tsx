import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Filter,
  Mail,
  MapPin,
  MessageSquare,
  Mic,
  Phone,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  X,
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { api, listRecords, createRecord, deleteRecord, errorMessage } from "./api"
import { LeadConversationDialog } from "./LeadConversationDialog"
import type { CrmRecord } from "./types"
import { recordId } from "./types"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dotColor: string }> = {
  New: { label: "New", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/40", dotColor: "bg-rose-500" },
  "Attempting Contact": { label: "Attempting Contact", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", dotColor: "bg-amber-500" },
  Contacted: { label: "Contacted", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40", dotColor: "bg-blue-500" },
  Qualified: { label: "Qualified", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", dotColor: "bg-emerald-500" },
  Appointment: { label: "Appointment", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40", dotColor: "bg-purple-500" },
  "Offer Made": { label: "Offer Made", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/40", dotColor: "bg-indigo-500" },
  Converted: { label: "Converted", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40", dotColor: "bg-green-500" },
  "Closed Lost": { label: "Closed Lost", color: "text-zinc-500 dark:text-zinc-400", bg: "bg-zinc-100 dark:bg-zinc-800/40", dotColor: "bg-zinc-400" },
}

const PRIORITY_BADGES: Record<string, string> = {
  Urgent: "bg-rose-500 text-white",
  High: "bg-amber-500 text-white",
  Medium: "bg-blue-500 text-white",
  Low: "bg-zinc-400 text-white",
}

export function LeadsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [workspaceTab, setWorkspaceTab] = useState<"overview" | "whatsapp" | "email" | "calls" | "meta">("overview")

  // New Lead Form State
  const [newLeadName, setNewLeadName] = useState("")
  const [newLeadEmail, setNewLeadEmail] = useState("")
  const [newLeadPhone, setNewLeadPhone] = useState("")
  const [newLeadAddress, setNewLeadAddress] = useState("")
  const [newLeadSource, setNewLeadSource] = useState("Website")
  const [newPriority, setNewPriority] = useState("Medium")

  // Selected Lead Drawer Edit States
  const [editNotes, setEditNotes] = useState("")
  const [editPriority, setEditPriority] = useState("Medium")
  const [editStatus, setEditStatus] = useState("New")

  // Schedule follow-up state inside lead drawer
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleType, setScheduleType] = useState("call")
  const [scheduleNotes, setScheduleNotes] = useState("")

  // AI Triage state
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null)

  // Fetch leads
  const { data: leads = [], isLoading, refetch } = useQuery<CrmRecord[]>({
    queryKey: ["records", "lead"],
    queryFn: async () => {
      const res = await listRecords("lead")
      return Array.isArray(res) ? res : []
    },
  })

  // Fetch followups for timeline
  const { data: followups = [] } = useQuery<CrmRecord[]>({
    queryKey: ["records", "lead-followup"],
    queryFn: async () => {
      const res = await listRecords("lead-followup")
      return Array.isArray(res) ? res : []
    },
  })

  // Filtered Leads
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leads.filter((item) => {
      const status = (item.leadStatus as string) || "New"
      if (statusFilter !== "all" && status !== statusFilter) return false
      if (q) {
        const name = String(item.leadName || "").toLowerCase()
        const email = String(item.leadEmail || "").toLowerCase()
        const phone = String(item.leadPhoneNumber || "").toLowerCase()
        const source = String(item.leadSource || "").toLowerCase()
        if (!name.includes(q) && !email.includes(q) && !phone.includes(q) && !source.includes(q)) return false
      }
      return true
    })
  }, [leads, query, statusFilter])

  // KPIs
  const stats = useMemo(() => {
    const total = leads.length
    const active = leads.filter((l) => ["New", "Attempting Contact", "Contacted", "Qualified", "Appointment"].includes(String(l.leadStatus || "New"))).length
    const converted = leads.filter((l) => l.leadStatus === "Converted").length
    const highPriority = leads.filter((l) => l.priority === "Urgent" || l.priority === "High").length
    const rate = total > 0 ? Math.round((converted / total) * 100) : 0
    return { total, active, converted, rate, highPriority }
  }, [leads])

  const selectedLead = leads.find((l) => recordId(l) === selectedId) || null
  const selectedLeadFollowups = followups.filter((f) => {
    const lId = typeof f.leadId === "object" ? recordId(f.leadId as any) : f.leadId
    return lId === selectedId
  })

  const selectLead = (lead: CrmRecord) => {
    const id = recordId(lead)
    setSelectedId(id)
    setEditNotes((lead.notes as string) || (lead.leadAddress as string) || "")
    setEditPriority((lead.priority as string) || "Medium")
    setEditStatus((lead.leadStatus as string) || "New")
  }

  useEffect(() => {
    const requestedLeadId = searchParams.get("leadId")
    if (!requestedLeadId || !leads.length) return
    const lead = leads.find((item) => recordId(item) === requestedLeadId)
    if (!lead) return
    selectLead(lead)
    const requestedChannel = searchParams.get("channel")
    setWorkspaceTab(requestedChannel === "email" ? "email" : requestedChannel === "calls" ? "calls" : "whatsapp")
    setWorkspaceOpen(true)
    setSearchParams({}, { replace: true })
  }, [leads, searchParams, setSearchParams])

  // Create Lead
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newLeadName.trim() || !newLeadPhone.trim()) throw new Error("Name and Phone are required")
      return api.post("/v1/leads", {
        leadName: newLeadName,
        leadEmail: newLeadEmail,
        leadPhoneNumber: newLeadPhone,
        leadAddress: newLeadAddress,
        leadSource: newLeadSource,
        priority: newPriority,
        leadStatus: "New",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records", "lead"] })
      toast.success("New lead created & added to pipeline!")
      setShowAddModal(false)
      setNewLeadName("")
      setNewLeadEmail("")
      setNewLeadPhone("")
      setNewLeadAddress("")
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  // Update Selected Lead
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLead) return
      return api.patch(`/v1/leads/${recordId(selectedLead)}`, {
        notes: editNotes,
        priority: editPriority,
        leadStatus: editStatus,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records", "lead"] })
      toast.success("Lead details updated")
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  // Schedule Follow-Up inside Drawer
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLead || !scheduleDate) throw new Error("Please select date and time")
      return api.post("/v1/followups", {
        leadId: recordId(selectedLead),
        followUpType: scheduleType,
        followUpDate: scheduleDate,
        priority: editPriority.toLowerCase(),
        notes: scheduleNotes || "Scheduled follow-up",
        status: "pending",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records", "lead-followup"] })
      toast.success("Follow-up scheduled!")
      setScheduleDate("")
      setScheduleNotes("")
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Leads Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Search, review, AI-triage, and manage your real estate pipeline from one focused workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="gap-2 bg-black text-white hover:bg-black/90">
            <Plus className="size-4" /> Add Lead
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Leads</CardTitle>
            <Users className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Recorded inquiries in CRM</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Pipelines</CardTitle>
            <Sparkles className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">New & active conversations</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Converted Deals</CardTitle>
            <TrendingUp className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.converted}</div>
            <p className="text-xs text-muted-foreground">{stats.rate}% conversion rate</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-600">High Priority</CardTitle>
            <Clock className="size-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.highPriority}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left / Main Table */}
        <div className="lg:col-span-8 space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, phone..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Attempting Contact">Attempting Contact</SelectItem>
                    <SelectItem value="Contacted">Contacted</SelectItem>
                    <SelectItem value="Qualified">Qualified</SelectItem>
                    <SelectItem value="Appointment">Appointment</SelectItem>
                    <SelectItem value="Offer Made">Offer Made</SelectItem>
                    <SelectItem value="Converted">Converted</SelectItem>
                    <SelectItem value="Closed Lost">Closed Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Lead Name</TableHead>
                  <TableHead>Phone / Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No leads match your search criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((lead) => {
                    const id = recordId(lead)
                    const isSelected = id === selectedId
                    const statusStr = (lead.leadStatus as string) || "New"
                    const statusConfig = STATUS_CONFIG[statusStr] || STATUS_CONFIG.New
                    const priorityStr = (lead.priority as string) || "Medium"
                    const badgeStyle = PRIORITY_BADGES[priorityStr] || PRIORITY_BADGES.Medium

                    return (
                      <TableRow
                        key={id}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-black/5 font-semibold" : "hover:bg-muted/40"}`}
                        onClick={() => selectLead(lead)}
                      >
                        <TableCell>
                          <div className="font-bold text-black">{lead.leadName as string}</div>
                          <div className="text-xs text-muted-foreground">{lead.leadSource as string || "Manual"}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>{lead.leadPhoneNumber as string || "No Phone"}</div>
                          <div className="text-muted-foreground">{lead.leadEmail as string || "No Email"}</div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusConfig.color} ${statusConfig.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                            {statusConfig.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={badgeStyle}>{priorityStr}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-7 text-xs">
                            Manage <ArrowRight className="ml-1 size-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Right Drawer / Selected Lead Details */}
        <div className="lg:col-span-4">
          {selectedLead ? (
            <Card className="sticky top-6 border-l-4 border-l-black">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold">{selectedLead.leadName as string}</CardTitle>
                    <CardDescription className="text-xs">{selectedLead.leadEmail as string || "No email"}</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1 text-xs"
                    onClick={() => {
                      setWorkspaceTab("calls")
                      setWorkspaceOpen(true)
                    }}
                  >
                    <PhoneCall className="size-3" /> Call
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 text-xs">
                {/* Contact Quick Buttons */}
                {selectedLead.leadPhoneNumber && (
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                      onClick={() => {
                        setWorkspaceTab("whatsapp")
                        setWorkspaceOpen(true)
                      }}
                    >
                      <MessageSquare className="mr-1.5 size-3.5" /> Open WhatsApp Conversation
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full text-xs"
                      disabled={!selectedLead.leadEmail}
                      onClick={() => {
                        setWorkspaceTab("email")
                        setWorkspaceOpen(true)
                      }}
                    >
                      <Mail className="mr-1.5 size-3.5" /> Open Email Thread
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full text-xs"
                      onClick={() => {
                        setWorkspaceTab("meta")
                        setWorkspaceOpen(true)
                      }}
                    >
                      <TrendingUp className="mr-1.5 size-3.5" /> View Meta Attribution
                    </Button>
                  </div>
                )}

                {/* Lead Status & Priority Settings */}
                <div className="space-y-3 rounded-lg bg-muted/40 p-3 border">
                  <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Lead Settings</div>
                  <div>
                    <Label className="mb-1 block text-xs">Pipeline Status</Label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Attempting Contact">Attempting Contact</SelectItem>
                        <SelectItem value="Contacted">Contacted</SelectItem>
                        <SelectItem value="Qualified">Qualified</SelectItem>
                        <SelectItem value="Appointment">Appointment</SelectItem>
                        <SelectItem value="Offer Made">Offer Made</SelectItem>
                        <SelectItem value="Converted">Converted</SelectItem>
                        <SelectItem value="Closed Lost">Closed Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-1 block text-xs">Priority Level</Label>
                    <Select value={editPriority} onValueChange={setEditPriority}>
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Urgent">Urgent</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-1 block text-xs">Lead Notes & Property Interests</Label>
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      className="bg-white text-xs"
                      placeholder="Add buyer requirements, budget, location preferences..."
                    />
                  </div>

                  <Button
                    size="sm"
                    className="w-full h-8 text-xs bg-black text-white hover:bg-black/90"
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Lead Updates"}
                  </Button>
                </div>

                {/* Schedule Follow-up Box */}
                <div className="space-y-3 rounded-lg bg-blue-50/50 p-3 border border-blue-200">
                  <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                    <CalendarClock className="size-4 text-blue-600" /> Schedule Follow-Up
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs text-blue-900">Date & Time *</Label>
                    <Input
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs text-blue-900">Interaction Type</Label>
                    <Select value={scheduleType} onValueChange={setScheduleType}>
                      <SelectTrigger className="h-8 text-xs bg-white">
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
                    <Textarea
                      placeholder="Follow-up task notes..."
                      value={scheduleNotes}
                      onChange={(e) => setScheduleNotes(e.target.value)}
                      rows={2}
                      className="bg-white text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => scheduleMutation.mutate()}
                    disabled={scheduleMutation.isPending}
                  >
                    {scheduleMutation.isPending ? "Scheduling..." : "Create Follow-Up"}
                  </Button>
                </div>

                {/* Follow-Up History Timeline */}
                <div className="space-y-2">
                  <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Follow-Up History ({selectedLeadFollowups.length})</div>
                  {selectedLeadFollowups.length === 0 ? (
                    <p className="text-muted-foreground italic">No follow-ups recorded yet for this lead.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedLeadFollowups.map((f) => (
                        <div key={recordId(f)} className="rounded border p-2 bg-white space-y-1">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="capitalize">{f.followUpType as string || "Call"}</span>
                            <Badge variant={f.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                              {String(f.status || "pending").toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground">
                            {f.followUpDate ? new Date(f.followUpDate as string).toLocaleString() : "Date unset"}
                          </div>
                          {f.notes && <p className="text-black/80">{f.notes as string}</p>}
                          {f.outcome && <p className="text-emerald-700 font-medium">Outcome: {f.outcome as string}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center border-dashed">
              <p className="text-sm text-muted-foreground">Select a lead from the table to view details & manage follow-ups.</p>
            </Card>
          )}
        </div>
      </div>

      {/* Add New Lead Dialog */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>Create a new lead entry in your sales pipeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1 block">Full Name *</Label>
              <Input
                placeholder="E.g., Aarav Mehta"
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Phone Number *</Label>
                <Input
                  placeholder="+91 98765 43210"
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1 block">Email Address</Label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={newLeadEmail}
                  onChange={(e) => setNewLeadEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="mb-1 block">Property / Mailing Address</Label>
              <Input
                placeholder="E.g., Sea View Residences, Bandra West"
                value={newLeadAddress}
                onChange={(e) => setNewLeadAddress(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Lead Source</Label>
                <Select value={newLeadSource} onValueChange={setNewLeadSource}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Website">Website</SelectItem>
                    <SelectItem value="Referral">Referral</SelectItem>
                    <SelectItem value="Property portal">Property portal</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="Open house">Open house</SelectItem>
                    <SelectItem value="Cold Call">Cold Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1 block">Priority</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button
              className="bg-black text-white hover:bg-black/90"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Add Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadConversationDialog
        lead={selectedLead}
        open={workspaceOpen}
        onOpenChange={setWorkspaceOpen}
        initialTab={workspaceTab}
      />
    </div>
  )
}

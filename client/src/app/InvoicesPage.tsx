import { useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BadgeIndianRupee,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Landmark,
  Layers,
  Mail,
  Pencil,
  Phone,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserCheck,
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
import { listRecords, createRecord, updateRecord, deleteRecord, errorMessage } from "./api"
import type { CrmRecord } from "./types"
import { numericValue, recordId } from "./types"

interface LineItem {
  id: string
  description: string
  sacCode: string
  quantity: number
  unitPrice: number
  amount: number
}

const DEFAULT_LINE_ITEMS: LineItem[] = [
  {
    id: "1",
    description: "Real Estate Brokerage & Success Fee (2%)",
    sacCode: "997222",
    quantity: 1,
    unitPrice: 750000,
    amount: 750000,
  },
  {
    id: "2",
    description: "Property Due Diligence & Legal Title Audit",
    sacCode: "998213",
    quantity: 1,
    unitPrice: 45000,
    amount: 45000,
  },
]

const formatINR = (val: number | string | undefined | null) => {
  const num = numericValue(val)
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num)
}

export function InvoicesPage() {
  const queryClient = useQueryClient()
  const printRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Modals state
  const [builderOpen, setBuilderOpen] = useState(false)
  const [documentOpen, setDocumentOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<CrmRecord | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Builder Form state
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [title, setTitle] = useState("")
  const [account, setAccount] = useState("")
  const [contact, setContact] = useState("")
  const [status, setStatus] = useState("Paid")
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [lineItems, setLineItems] = useState<LineItem[]>(DEFAULT_LINE_ITEMS)

  // Fetch Invoices
  const { data: invoices = [], isLoading, refetch } = useQuery<CrmRecord[]>({
    queryKey: ["records", "invoices"],
    queryFn: async () => {
      const res = await listRecords("invoices")
      return Array.isArray(res) ? res : []
    },
  })

  // Fetch Accounts & Contacts for selection
  const { data: accounts = [] } = useQuery<CrmRecord[]>({
    queryKey: ["records", "account"],
    queryFn: async () => {
      const res = await listRecords("account")
      return Array.isArray(res) ? res : []
    },
  })

  const { data: contacts = [] } = useQuery<CrmRecord[]>({
    queryKey: ["records", "contact"],
    queryFn: async () => {
      const res = await listRecords("contact")
      return Array.isArray(res) ? res : []
    },
  })

  // KPIs
  const stats = useMemo(() => {
    let totalInvoiced = 0
    let paidRevenue = 0
    let outstanding = 0
    let overdueCount = 0

    invoices.forEach((inv) => {
      const amt = numericValue(inv.grandTotal)
      const st = String(inv.status || "Draft").toLowerCase()
      totalInvoiced += amt

      if (st === "paid") {
        paidRevenue += amt
      } else if (st === "sent" || st === "outstanding" || st === "draft") {
        outstanding += amt
      } else if (st === "overdue") {
        outstanding += amt
        overdueCount++
      }
    })

    return { totalInvoiced, paidRevenue, outstanding, overdueCount }
  }, [invoices])

  // Filtered List
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invoices.filter((inv) => {
      const st = (inv.status as string) || "Draft"
      if (statusFilter !== "all" && st.toLowerCase() !== statusFilter.toLowerCase()) return false

      if (q) {
        const num = String(inv.invoiceNumber || "").toLowerCase()
        const t = String(inv.title || "").toLowerCase()
        const acc = String(inv.account || "").toLowerCase()
        const c = String(inv.contact || "").toLowerCase()
        if (!num.includes(q) && !t.includes(q) && !acc.includes(q) && !c.includes(q)) return false
      }
      return true
    })
  }, [invoices, search, statusFilter])

  // Calculations inside Builder
  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)
  }, [lineItems])

  const gstTax = useMemo(() => Math.round(subtotal * 0.18), [subtotal])
  const grandTotal = useMemo(() => subtotal + gstTax, [subtotal, gstTax])

  // Reset Builder
  const handleOpenBuilder = (inv?: CrmRecord) => {
    if (inv) {
      setEditingId(recordId(inv))
      setInvoiceNumber((inv.invoiceNumber as string) || `INV-2026-${Math.floor(100 + Math.random() * 900)}`)
      setTitle((inv.title as string) || "")
      setAccount((inv.account as string) || "")
      setContact((inv.contact as string) || "")
      setStatus((inv.status as string) || "Paid")
      setDueDate(inv.createdDate ? new Date(inv.createdDate as string).toISOString().slice(0, 10) : "")
      setNotes((inv.notes as string) || "Payment due within 15 days of invoice date.")

      if (Array.isArray(inv.items)) {
        setLineItems(inv.items as LineItem[])
      } else {
        setLineItems([
          {
            id: "1",
            description: (inv.title as string) || "Real Estate Brokerage Services",
            sacCode: "997222",
            quantity: 1,
            unitPrice: numericValue(inv.grandTotal) || 500000,
            amount: numericValue(inv.grandTotal) || 500000,
          },
        ])
      }
    } else {
      setEditingId(null)
      setInvoiceNumber(`INV-2026-${Math.floor(100 + Math.random() * 900)}`)
      setTitle("Commission & Advisory Fee — Sea View Project")
      setAccount(accounts[0]?.name as string || "Harbourline Holdings")
      setContact(contacts[0]?.fullName as string || "Vikram Malhotra")
      setStatus("Paid")
      setDueDate(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10))
      setNotes("Payment due within 14 business days. All disputes subject to Mumbai jurisdiction.")
      setLineItems(DEFAULT_LINE_ITEMS)
    }
    setBuilderOpen(true)
  }

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Invoice title is required")
      const payload = {
        title,
        invoiceNumber: invoiceNumber || `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
        status,
        grandTotal: String(grandTotal),
        account,
        contact,
        items: lineItems,
        notes,
      }

      if (editingId) {
        return updateRecord("invoices", editingId, payload)
      } else {
        return createRecord("invoices", payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records", "invoices"] })
      toast.success(editingId ? "Invoice updated" : "Official invoice created")
      setBuilderOpen(false)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  // Quick Status Toggle Mutation
  const markPaidMutation = useMutation({
    mutationFn: async (inv: CrmRecord) => {
      return updateRecord("invoices", recordId(inv), { status: "Paid" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records", "invoices"] })
      toast.success("Invoice marked as PAID!")
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteRecord("invoices", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records", "invoices"] })
      toast.success("Invoice record removed")
    },
  })

  // Line Item Handlers
  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        description: "Advisory & Concierge Service",
        sacCode: "997222",
        quantity: 1,
        unitPrice: 50000,
        amount: 50000,
      },
    ])
  }

  const handleUpdateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const updated = { ...item, [field]: value }
        if (field === "quantity" || field === "unitPrice") {
          const qty = field === "quantity" ? Number(value) : item.quantity
          const price = field === "unitPrice" ? Number(value) : item.unitPrice
          updated.amount = qty * price
        }
        return updated
      })
    )
  }

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      toast.error("An invoice must contain at least one line item")
      return
    }
    setLineItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Real Estate Billing & Invoices</h1>
          <p className="text-sm text-muted-foreground">
            RERA & GST compliant billing statements, brokerage commission receipts, and official customer letterheads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button onClick={() => handleOpenBuilder()} className="gap-2 bg-black text-white hover:bg-black/90">
            <Plus className="size-4" /> Create Invoice
          </Button>
        </div>
      </div>

      {/* Financial Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Invoiced Volume</CardTitle>
            <ReceiptText className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(stats.totalInvoiced)}</div>
            <p className="text-xs text-muted-foreground">All time billing statements</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-700">Collected Revenue</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatINR(stats.paidRevenue)}</div>
            <p className="text-xs text-muted-foreground">Fully paid & cleared invoices</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700">Outstanding Receivables</CardTitle>
            <Clock className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatINR(stats.outstanding)}</div>
            <p className="text-xs text-muted-foreground">Sent & pending payment</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-rose-600">Overdue Invoices</CardTitle>
            <Clock className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{stats.overdueCount}</div>
            <p className="text-xs text-muted-foreground">Past due date threshold</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter / Search Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice number (e.g. INV-2026-041), title, account, or contact..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Sent">Sent / Pending</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Invoice #</TableHead>
              <TableHead>Title & Description</TableHead>
              <TableHead>Billed Client / Account</TableHead>
              <TableHead>Grand Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-36 text-center text-muted-foreground">
                  No invoice records match your criteria.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv) => {
                const id = recordId(inv)
                const st = (inv.status as string) || "Draft"
                const invNum = (inv.invoiceNumber as string) || `INV-${id.slice(0, 6)}`
                const isPaid = st.toLowerCase() === "paid"
                const isOverdue = st.toLowerCase() === "overdue"

                return (
                  <TableRow
                    key={id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => {
                      setSelectedInvoice(inv)
                      setDocumentOpen(true)
                    }}
                  >
                    <TableCell className="font-mono text-xs font-bold text-black">{invNum}</TableCell>
                    <TableCell>
                      <div className="font-bold text-black">{inv.title as string || "Real Estate Service Invoice"}</div>
                      <div className="text-xs text-muted-foreground">
                        {inv.createdDate ? new Date(inv.createdDate as string).toLocaleDateString() : "Recent"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold text-black">{inv.account as string || "Client Account"}</div>
                      <div className="text-muted-foreground">{inv.contact as string || "Primary Contact"}</div>
                    </TableCell>
                    <TableCell className="font-display font-bold text-sm text-black">
                      {formatINR(inv.grandTotal)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={isPaid ? "default" : isOverdue ? "destructive" : "secondary"}
                        className={isPaid ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                      >
                        {st.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs bg-black text-white hover:bg-black/90 gap-1"
                          onClick={() => {
                            setSelectedInvoice(inv)
                            setDocumentOpen(true)
                          }}
                        >
                          <Printer className="size-3" /> Letterhead
                        </Button>
                        {!isPaid && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-emerald-600 hover:bg-emerald-50"
                            title="Mark as Paid"
                            onClick={() => markPaidMutation.mutate(inv)}
                          >
                            <CheckCircle2 className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="Edit Invoice"
                          onClick={() => handleOpenBuilder(inv)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-rose-600"
                          title="Delete Invoice"
                          onClick={() => deleteMutation.mutate(id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Invoice Builder / Editor Modal */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Invoice Statement" : "Create Official Real Estate Invoice"}</DialogTitle>
            <DialogDescription>Itemized billing breakdown, RERA tax calculations & client information.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Header info */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Invoice Number *</Label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Sent">Sent / Outstanding</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Invoice Title / Purpose *</Label>
              <Input
                placeholder="E.g., Brokerage Commission & Advisory Fee — Sea View Residences"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Billed Account & Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Billed Account / Organization</Label>
                <Select value={account} onValueChange={setAccount}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={recordId(acc)} value={acc.name as string || "Account"}>
                        {acc.name as string}
                      </SelectItem>
                    ))}
                    <SelectItem value="Harbourline Holdings">Harbourline Holdings</SelectItem>
                    <SelectItem value="Northstar Living">Northstar Living</SelectItem>
                    <SelectItem value="Crescent Family Office">Crescent Family Office</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1 block text-xs">Primary Client Contact</Label>
                <Select value={contact} onValueChange={setContact}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={recordId(c)} value={c.fullName as string || "Contact"}>
                        {c.fullName as string}
                      </SelectItem>
                    ))}
                    <SelectItem value="Vikram Malhotra">Vikram Malhotra</SelectItem>
                    <SelectItem value="Aarav Mehta">Aarav Mehta</SelectItem>
                    <SelectItem value="Nisha Kapoor">Nisha Kapoor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Itemized Line Items Table Builder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider">Itemized Line Items (SAC / HSN Breakdown)</Label>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleAddLineItem}>
                  <Plus className="size-3" /> Add Item
                </Button>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Service Description</TableHead>
                      <TableHead className="w-24">SAC Code</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="w-32">Rate (₹)</TableHead>
                      <TableHead className="w-32 text-right">Amount (₹)</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs font-mono">{idx + 1}</TableCell>
                        <TableCell>
                          <Input
                            value={item.description}
                            onChange={(e) => handleUpdateLineItem(item.id, "description", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.sacCode}
                            onChange={(e) => handleUpdateLineItem(item.id, "sacCode", e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleUpdateLineItem(item.id, "quantity", e.target.value)}
                            className="h-8 text-xs text-center"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateLineItem(item.id, "unitPrice", e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs">
                          {formatINR(item.amount)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-rose-600"
                            onClick={() => handleRemoveLineItem(item.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Financial Calculation Summary Box */}
              <div className="flex justify-end pt-2">
                <div className="w-72 space-y-2 rounded-lg bg-muted/30 p-3 border text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-mono font-semibold">{formatINR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST Tax (18%):</span>
                    <span className="font-mono font-semibold">{formatINR(gstTax)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-sm">
                    <span>Grand Total:</span>
                    <span className="font-mono text-emerald-700">{formatINR(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Invoice Terms & Bank Payment Instructions</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBuilderOpen(false)}>Cancel</Button>
            <Button
              className="bg-black text-white hover:bg-black/90"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Official Printable Document Letterhead Modal */}
      <Dialog open={documentOpen} onOpenChange={setDocumentOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <div className="flex items-center justify-between pr-6">
              <div>
                <DialogTitle>Official Printable Invoice Letterhead</DialogTitle>
                <DialogDescription>Formatted RERA & GST Real Estate Tax Invoice for client handover.</DialogDescription>
              </div>
              <Button onClick={handlePrint} className="gap-2 bg-black text-white hover:bg-black/90">
                <Printer className="size-4" /> Print / Save PDF
              </Button>
            </div>
          </DialogHeader>

          {/* Printable Sheet */}
          {selectedInvoice && (
            <div ref={printRef} className="p-8 bg-white text-black font-sans space-y-8 rounded-lg border shadow-sm print:border-0 print:shadow-none print:p-0">
              {/* Corporate Letterhead Header */}
              <div className="flex items-start justify-between border-b border-black pb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-full bg-black text-white font-bold text-xl">
                      M
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-widest text-black">MOON ESTATE</h2>
                      <p className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">Estate Intelligence & Advisory</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-600 mt-3 max-w-xs leading-relaxed">
                    Level 14, One BKC, Bandra Kurla Complex, Mumbai, Maharashtra 400051<br />
                    Corporate Desk: +91 98765 43210 &bull; info@moonestates.example
                  </p>
                </div>

                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-black text-white text-xs font-bold tracking-widest uppercase rounded">
                    TAX INVOICE
                  </span>
                  <div className="mt-3 text-xs text-zinc-600 space-y-1">
                    <p><strong>Invoice No:</strong> <span className="font-mono font-bold text-black">{selectedInvoice.invoiceNumber || `INV-2026-${recordId(selectedInvoice).slice(0, 4)}`}</span></p>
                    <p><strong>Invoice Date:</strong> {selectedInvoice.createdDate ? new Date(selectedInvoice.createdDate as string).toLocaleDateString("en-IN", { dateStyle: "long" }) : "Today"}</p>
                    <p><strong>RERA Registration No:</strong> MAHARERA/PRM/2026/08941</p>
                    <p><strong>GSTIN:</strong> 27AABCM8941K1Z2 &bull; <strong>CIN:</strong> U70100MH2026PTC384912</p>
                  </div>
                </div>
              </div>

              {/* Billed Client Info */}
              <div className="grid grid-cols-2 gap-8 bg-zinc-50 p-4 rounded-lg border border-zinc-200 text-xs">
                <div>
                  <p className="font-bold text-zinc-500 uppercase tracking-wider text-[10px] mb-1">BILLED TO (CLIENT / ACCOUNT)</p>
                  <p className="font-bold text-base text-black">{selectedInvoice.account as string || "Harbourline Holdings"}</p>
                  <p className="text-zinc-700 mt-1"><strong>Attention:</strong> {selectedInvoice.contact as string || "Vikram Malhotra"}</p>
                  <p className="text-zinc-600">Mumbai, Maharashtra &bull; India</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-zinc-500 uppercase tracking-wider text-[10px] mb-1">PAYMENT STATUS</p>
                  <p className="text-lg font-bold text-emerald-600">{String(selectedInvoice.status || "PAID").toUpperCase()}</p>
                  <p className="text-zinc-600 mt-1"><strong>Currency:</strong> Indian Rupee (INR ₹)</p>
                  <p className="text-zinc-600"><strong>Place of Supply:</strong> Maharashtra (27)</p>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-black text-white font-bold uppercase tracking-wider">
                      <th className="p-3 text-left w-12">#</th>
                      <th className="p-3 text-left">Service Description</th>
                      <th className="p-3 text-center w-24">SAC Code</th>
                      <th className="p-3 text-center w-16">Qty</th>
                      <th className="p-3 text-right w-28">Rate (₹)</th>
                      <th className="p-3 text-right w-32">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 border-b border-zinc-300">
                    {Array.isArray(selectedInvoice.items) && (selectedInvoice.items as LineItem[]).length > 0 ? (
                      (selectedInvoice.items as LineItem[]).map((item, index) => (
                        <tr key={index}>
                          <td className="p-3 font-mono text-zinc-500">{index + 1}</td>
                          <td className="p-3 font-semibold text-black">{item.description}</td>
                          <td className="p-3 text-center font-mono text-zinc-600">{item.sacCode || "997222"}</td>
                          <td className="p-3 text-center">{item.quantity || 1}</td>
                          <td className="p-3 text-right font-mono">{formatINR(item.unitPrice)}</td>
                          <td className="p-3 text-right font-mono font-bold">{formatINR(item.amount)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-3 font-mono text-zinc-500">1</td>
                        <td className="p-3 font-semibold text-black">{selectedInvoice.title as string || "Brokerage Commission & Advisory Services"}</td>
                        <td className="p-3 text-center font-mono text-zinc-600">997222</td>
                        <td className="p-3 text-center">1</td>
                        <td className="p-3 text-right font-mono">{formatINR(selectedInvoice.grandTotal)}</td>
                        <td className="p-3 text-right font-mono font-bold">{formatINR(selectedInvoice.grandTotal)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Calculation & Terms */}
              <div className="grid grid-cols-12 gap-6 pt-2">
                <div className="col-span-7 space-y-4 text-xs">
                  <div className="rounded-lg bg-zinc-50 p-4 border border-zinc-200">
                    <p className="font-bold text-zinc-700 mb-1">Bank Payment & Escrow Transfer Details</p>
                    <p className="text-zinc-600"><strong>Account Name:</strong> MooN Estate Intelligence Pvt Ltd</p>
                    <p className="text-zinc-600"><strong>Bank Name:</strong> HDFC Bank Ltd (BKC Branch)</p>
                    <p className="text-zinc-600 font-mono"><strong>Account No:</strong> 50200084920194 &bull; <strong>IFSC:</strong> HDFC0000240</p>
                    <p className="text-zinc-600"><strong>UPI ID:</strong> moonestates@upi</p>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed italic">
                    Note: {selectedInvoice.notes as string || "Payment terms: Net 15 days. GST at 18% charged under Real Estate Auxiliary Services (SAC 997222)."}
                  </p>
                </div>

                <div className="col-span-5 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-zinc-200">
                    <span className="text-zinc-600">Subtotal:</span>
                    <span className="font-mono font-semibold">{formatINR(numericValue(selectedInvoice.grandTotal) * 0.847)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-200">
                    <span className="text-zinc-600">CGST (9%):</span>
                    <span className="font-mono font-semibold">{formatINR(numericValue(selectedInvoice.grandTotal) * 0.076)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-200">
                    <span className="text-zinc-600">SGST (9%):</span>
                    <span className="font-mono font-semibold">{formatINR(numericValue(selectedInvoice.grandTotal) * 0.076)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b-2 border-black font-bold text-sm">
                    <span>Grand Total:</span>
                    <span className="font-mono text-emerald-700">{formatINR(selectedInvoice.grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Authorised Signature */}
              <div className="flex items-end justify-between pt-12 text-xs border-t border-zinc-200">
                <div>
                  <p className="text-zinc-500">Computer Generated Tax Invoice Statement</p>
                  <p className="text-[10px] text-zinc-400">MooN Estate Intelligence &bull; RERA Approved</p>
                </div>
                <div className="text-center">
                  <div className="font-serif italic text-base text-zinc-800 font-bold mb-1">MooN Estate Partner</div>
                  <p className="border-t border-zinc-400 pt-1 text-[11px] font-bold text-zinc-700 uppercase">Authorised Signatory</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

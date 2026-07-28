import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BanknoteArrowDown, CircleDollarSign, FileCheck2, Handshake, Plus, RotateCcw } from "lucide-react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "./auth"
import { api, errorMessage } from "./api"

type Project = { id: string; name: string }
type Unit = {
  id: string
  unitNumber: string
  unitType?: string | null
  listingPrice?: number | string | null
  baseCost?: number | string | null
  status: string
  structureName: string
  floorNumber: number | null
}
type Deal = {
  id: string
  dealNumber: string
  status: string
  projectId: string
  unitId: string
  agreementNumber?: string | null
  grossPrice: number
  discount: number
  netSaleValue: number
  agencyCommission: number
  developerGrossProfit?: number
  updatedDate: string
  unitNumber?: string
  unitType?: string | null
  structureName?: string
  projectName?: string
}

const money = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0))

export function SalesDeskPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canExecute = ["platform_owner", "organization_owner", "organization_admin", "sales_manager"].includes(user?.role || "")
  const canCollect = canExecute || user?.role === "finance"
  const [dialogOpen, setDialogOpen] = useState(false)
  const [projectId, setProjectId] = useState("")
  const [form, setForm] = useState({
    unitId: "",
    grossPrice: "",
    discount: "0",
    taxes: "0",
    baseCost: "",
    brokerage: "0",
    directExpenses: "0",
    agencyCommission: "0",
  })
  const projects = useQuery({
    queryKey: ["operational-projects"],
    queryFn: async () => (await api.get<{ data: Project[] }>("/v1/projects")).data.data,
  })
  const inventory = useQuery({
    queryKey: ["project-inventory", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => (await api.get(`/v1/projects/${projectId}/inventory`)).data.data,
  })
  const deals = useQuery({
    queryKey: ["deals"],
    queryFn: async () => (await api.get<{ data: Deal[] }>("/v1/deals")).data.data,
  })
  const units = useMemo<Unit[]>(() => {
    const structures = inventory.data?.structures || []
    return structures.flatMap((structure: Record<string, unknown>) => {
      const levels = (structure.levels || []) as Array<Record<string, unknown>>
      const levelled = levels.flatMap((level) =>
        ((level.units || []) as Unit[]).map((unit) => ({
          ...unit,
          structureName: String(structure.name),
          floorNumber: Number(level.levelNumber),
        })))
      const unlevelled = ((structure.unlevelledUnits || []) as Unit[]).map((unit) => ({
        ...unit,
        structureName: String(structure.name),
        floorNumber: null,
      }))
      return [...levelled, ...unlevelled]
    })
  }, [inventory.data])
  const selectedUnit = units.find((unit) => unit.id === form.unitId)

  const resetForm = () => {
    setProjectId("")
    setForm({
      unitId: "",
      grossPrice: "",
      discount: "0",
      taxes: "0",
      baseCost: "",
      brokerage: "0",
      directExpenses: "0",
      agencyCommission: "0",
    })
  }

  const createDeal = useMutation({
    mutationFn: () => api.post("/v1/deals", {
      unitId: form.unitId,
      grossPrice: Number(form.grossPrice),
      discount: Number(form.discount || 0),
      taxes: Number(form.taxes || 0),
      baseCost: form.baseCost ? Number(form.baseCost) : undefined,
      brokerage: Number(form.brokerage || 0),
      directExpenses: Number(form.directExpenses || 0),
      agencyCommission: Number(form.agencyCommission || 0),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deals"] })
      setDialogOpen(false)
      resetForm()
      toast.success("Draft deal created")
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const action = useMutation({
    mutationFn: async ({ deal, type }: { deal: Deal; type: "reserve" | "execute" | "cancel" | "payment" }) => {
      if (type === "reserve") return api.post(`/v1/deals/${deal.id}/reserve`)
      if (type === "execute") {
        const agreementNumber = window.prompt("Agreement number")
        if (!agreementNumber) throw new Error("Agreement execution cancelled")
        return api.post(`/v1/deals/${deal.id}/execute`, {
          agreementNumber,
          agreementExecutedAt: new Date().toISOString(),
        })
      }
      if (type === "cancel") {
        const reason = window.prompt("Cancellation reason")
        if (!reason) throw new Error("Cancellation cancelled")
        return api.post(`/v1/deals/${deal.id}/cancel`, { reason })
      }
      const amount = window.prompt("Confirmed amount received")
      if (!amount) throw new Error("Payment entry cancelled")
      const reference = window.prompt("Payment reference") || undefined
      return api.post(`/v1/deals/${deal.id}/payments`, {
        amount: Number(amount),
        reference,
        paidAt: new Date().toISOString(),
        status: "Confirmed",
      })
    },
    onSuccess: async (_response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-summary"] }),
      ])
      toast.success(
        variables.type === "reserve" ? "Unit reserved"
          : variables.type === "execute" ? "Agreement executed and unit sold"
            : variables.type === "cancel" ? "Deal cancelled and availability reversed"
              : "Collection recorded",
      )
    },
    onError: (error) => {
      if (!errorMessage(error).toLowerCase().includes("cancelled")) toast.error(errorMessage(error))
    },
  })

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Transactional sales desk</p>
          <h1 className="mt-2 font-display text-4xl sm:text-6xl">Reservation to agreement.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Every deal is tied to one real inventory unit, with auditable pricing, agreement recognition, collections and reversals.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus /> New deal</Button>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-[10px] font-bold uppercase text-muted-foreground">Open reservations</p><p className="mt-2 font-display text-3xl">{(deals.data || []).filter((deal) => deal.status === "Reserved").length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-[10px] font-bold uppercase text-muted-foreground">Executed agreements</p><p className="mt-2 font-display text-3xl">{(deals.data || []).filter((deal) => deal.status === "AgreementExecuted").length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-[10px] font-bold uppercase text-muted-foreground">Visible sales value</p><p className="mt-2 font-display text-3xl">{money((deals.data || []).filter((deal) => deal.status === "AgreementExecuted").reduce((sum, deal) => sum + Number(deal.netSaleValue), 0))}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Deal register</CardTitle><CardDescription>Drafts do not affect availability. Reservation and execution are protected against double-selling.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Deal</TableHead><TableHead>Status</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Net sale</TableHead><TableHead className="text-right">Commission</TableHead><TableHead>Agreement</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {(deals.data || []).map((deal) => {
                return <TableRow key={deal.id}><TableCell className="font-mono text-xs">{deal.dealNumber}</TableCell><TableCell><Badge variant={deal.status === "Cancelled" ? "destructive" : "outline"}>{deal.status}</Badge></TableCell><TableCell><p className="font-semibold">#{deal.unitNumber || deal.unitId.slice(0, 8)}</p><p className="text-xs text-muted-foreground">{deal.projectName || "Project"} · {deal.structureName || "Inventory"}</p></TableCell><TableCell className="text-right font-semibold">{money(deal.netSaleValue)}</TableCell><TableCell className="text-right">{money(deal.agencyCommission)}</TableCell><TableCell>{deal.agreementNumber || "—"}</TableCell><TableCell><div className="flex justify-end gap-1">{deal.status === "Draft" && <Button size="sm" variant="outline" onClick={() => action.mutate({ deal, type: "reserve" })}><Handshake /> Reserve</Button>}{canExecute && ["Draft", "Reserved"].includes(deal.status) && <Button size="sm" onClick={() => action.mutate({ deal, type: "execute" })}><FileCheck2 /> Execute</Button>}{canCollect && deal.status === "AgreementExecuted" && <Button size="sm" variant="outline" onClick={() => action.mutate({ deal, type: "payment" })}><BanknoteArrowDown /> Receipt</Button>}{canExecute && !["Cancelled"].includes(deal.status) && <Button size="icon" variant="ghost" aria-label={`Cancel ${deal.dealNumber}`} onClick={() => action.mutate({ deal, type: "cancel" })}><RotateCcw /></Button>}</div></TableCell></TableRow>
              })}
              {!deals.isPending && !deals.data?.length && <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No transactional deals yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Create draft deal</DialogTitle><DialogDescription>Select a live inventory unit and capture the commercial basis. Reserve it only when the buyer commits.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-3 sm:grid-cols-2">
            <Field label="Project"><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={projectId} onChange={(event) => { setProjectId(event.target.value); setForm({ ...form, unitId: "" }) }}><option value="">Select project</option>{(projects.data || []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>
            <Field label="Available unit"><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.unitId} onChange={(event) => { const unit = units.find((item) => item.id === event.target.value); setForm({ ...form, unitId: event.target.value, grossPrice: String(unit?.listingPrice || ""), baseCost: String(unit?.baseCost || "") }) }}><option value="">Select unit</option>{units.filter((unit) => ["Available", "Hold"].includes(unit.status)).map((unit) => <option key={unit.id} value={unit.id}>{unit.structureName} · {unit.floorNumber === null ? "" : `F${unit.floorNumber} · `}#{unit.unitNumber} · {money(unit.listingPrice)}</option>)}</select></Field>
            <Field label="Gross price"><Input type="number" value={form.grossPrice} onChange={(event) => setForm({ ...form, grossPrice: event.target.value })} /></Field>
            <Field label="Discount"><Input type="number" value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value })} /></Field>
            <Field label="Taxes"><Input type="number" value={form.taxes} onChange={(event) => setForm({ ...form, taxes: event.target.value })} /></Field>
            {canExecute && <Field label="Base / acquisition cost"><Input type="number" value={form.baseCost} onChange={(event) => setForm({ ...form, baseCost: event.target.value })} /></Field>}
            {canExecute && <Field label="Brokerage expense"><Input type="number" value={form.brokerage} onChange={(event) => setForm({ ...form, brokerage: event.target.value })} /></Field>}
            {canExecute && <Field label="Other direct expenses"><Input type="number" value={form.directExpenses} onChange={(event) => setForm({ ...form, directExpenses: event.target.value })} /></Field>}
            <Field label="Agency commission"><Input type="number" value={form.agencyCommission} onChange={(event) => setForm({ ...form, agencyCommission: event.target.value })} /></Field>
            <Card className="sm:col-span-2"><CardContent className="grid grid-cols-2 gap-4 p-4"><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Net sale</p><p className="font-display text-2xl">{money(Number(form.grossPrice || 0) - Number(form.discount || 0))}</p></div><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Selected inventory</p><p className="font-semibold">{selectedUnit ? `${selectedUnit.structureName} · #${selectedUnit.unitNumber}` : "No unit selected"}</p></div></CardContent></Card>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button disabled={!form.unitId || !Number(form.grossPrice) || createDeal.isPending} onClick={() => createDeal.mutate()}><CircleDollarSign /> Create draft</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-xs font-semibold">{label}</Label>{children}</div>
}

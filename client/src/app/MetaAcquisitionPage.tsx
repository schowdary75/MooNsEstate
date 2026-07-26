import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { BarChart3, IndianRupee, Megaphone, RefreshCw, Target, Users } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api, errorMessage } from "./api"

type AcquisitionData = {
  totals: {
    spend: number
    impressions: number
    reach: number
    clicks: number
    linkClicks: number
    crmLeads: number
    qualified: number
    converted: number
    costPerLead: number
    costPerQualifiedLead: number
    siteVisits: number
    costPerVisit: number
    opportunities: number
    wins: number
    revenue: number
    roas: number
  }
  campaigns: Array<{
    id: string
    externalId: string
    name: string
    status?: string | null
    spend: number
    impressions: number
    clicks: number
    leads: number
    costPerLead: number
    qualified: number
    siteVisits: number
    opportunities: number
    wins: number
    revenue: number
    roas: number
  }>
  submissions: Array<{ id: string }>
}

const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0)

export function MetaAcquisitionPage() {
  const defaultSince = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString().slice(0, 10)
  const defaultUntil = new Date().toISOString().slice(0, 10)
  const [since, setSince] = useState(defaultSince)
  const [until, setUntil] = useState(defaultUntil)

  const acquisition = useQuery<AcquisitionData>({
    queryKey: ["meta-acquisition", since, until],
    queryFn: async () => {
      const response = await api.get(`/v1/meta/acquisition?since=${since}&until=${until}`)
      return response.data.data
    },
  })

  const sync = useMutation({
    mutationFn: () => api.post("/v1/meta/sync", { since, until }),
    onSuccess: (response) => {
      toast.success(`${response.data.data.synced} Meta insight rows synchronized`)
      void acquisition.refetch()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const totals = acquisition.data?.totals
  const kpis = [
    { label: "Ad spend", value: inr(totals?.spend || 0), detail: `${totals?.impressions || 0} impressions`, icon: IndianRupee },
    { label: "CRM leads", value: totals?.crmLeads || 0, detail: `${inr(totals?.costPerLead || 0)} CPL`, icon: Users },
    { label: "Qualified", value: totals?.qualified || 0, detail: `${inr(totals?.costPerQualifiedLead || 0)} per qualified`, icon: Target },
    { label: "Revenue / ROAS", value: inr(totals?.revenue || 0), detail: `${(totals?.roas || 0).toFixed(2)}× ROAS · ${totals?.wins || 0} wins`, icon: BarChart3 },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Meta Acquisition</p>
          <h1 className="font-display text-3xl font-bold">Campaign-to-revenue attribution</h1>
          <p className="mt-1 text-sm text-muted-foreground">Read-only campaign performance joined with actual CRM outcomes.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold">Since<Input type="date" value={since} onChange={(event) => setSince(event.target.value)} /></label>
          <label className="text-xs font-semibold">Until<Input type="date" value={until} onChange={(event) => setUntil(event.target.value)} /></label>
          <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className={`size-4 ${sync.isPending ? "animate-spin" : ""}`} /> Sync Meta
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div>
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</CardTitle>
                <p className="mt-2 text-3xl font-semibold">{item.value}</p>
              </div>
              <div className="rounded-xl bg-slate-100 p-2"><item.icon className="size-5" /></div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{item.detail}</CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone className="size-5" /> Campaign performance</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Impressions</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">CRM Leads</TableHead>
              <TableHead className="text-right">Qualified</TableHead>
              <TableHead className="text-right">Visits</TableHead>
              <TableHead className="text-right">Wins</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
              <TableHead className="text-right">CPL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {acquisition.isLoading ? (
              <TableRow><TableCell colSpan={12} className="h-32 text-center">Loading Meta insights…</TableCell></TableRow>
            ) : !acquisition.data?.campaigns.length ? (
              <TableRow><TableCell colSpan={12} className="h-32 text-center text-muted-foreground">Connect Meta and run a sync to populate acquisition reporting.</TableCell></TableRow>
            ) : acquisition.data.campaigns.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell>
                  <p className="font-semibold">{campaign.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{campaign.externalId}</p>
                </TableCell>
                <TableCell><Badge variant="outline">{campaign.status || "Unknown"}</Badge></TableCell>
                <TableCell className="text-right">{inr(campaign.spend)}</TableCell>
                <TableCell className="text-right">{campaign.impressions.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right">{campaign.clicks.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right">{campaign.leads}</TableCell>
                <TableCell className="text-right">{campaign.qualified}</TableCell>
                <TableCell className="text-right">{campaign.siteVisits}</TableCell>
                <TableCell className="text-right">{campaign.wins}</TableCell>
                <TableCell className="text-right">{inr(campaign.revenue)}</TableCell>
                <TableCell className="text-right">{campaign.roas.toFixed(2)}×</TableCell>
                <TableCell className="text-right">{inr(campaign.costPerLead)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  BadgeIndianRupee,
  BanknoteArrowDown,
  Building2,
  CircleDollarSign,
  RotateCcw,
  TrendingUp,
  UsersRound,
} from "lucide-react"
import { Link } from "react-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api, errorMessage } from "./api"

type SalesSummary = {
  period: { from: string; to: string; timezone: string; currency: string }
  kpis: {
    unitsSold: number
    netSales: number
    developerGrossProfit: number | null
    agencyCommission: number
    collections: number
    cancellations: number
    averageSellingPrice: number
    marginPercent: number | null
  }
  deals: Array<{
    id: string
    dealNumber: string
    agreementExecutedAt: string
    projectName: string
    structureName: string
    unitNumber: string
    agentName: string
    netSaleValue: number
    developerGrossProfit?: number
    agencyCommission: number
  }>
  daily: Array<{ date: string; unitsSold: number; netSales: number; collections: number }>
  agentLeaderboard: Array<{ agentId: string; agentName: string; unitsSold: number; netSales: number }>
}

const localDate = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const money = (value: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)

export function OperationsDashboardPage() {
  const today = useMemo(localDate, [])
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const summary = useQuery({
    queryKey: ["sales-summary", from, to],
    queryFn: async () => {
      const response = await api.get<{ data: SalesSummary }>("/v1/reports/sales-summary", {
        params: { from, to },
      })
      return response.data.data
    },
  })
  const currency = summary.data?.period.currency || "INR"
  const kpis = summary.data?.kpis
  const cards = [
    { label: "Units sold", value: String(kpis?.unitsSold || 0), note: "Executed agreements", icon: Building2 },
    { label: "Net sales", value: money(kpis?.netSales || 0, currency), note: "After discounts, before tax", icon: CircleDollarSign },
    {
      label: "Developer profit",
      value: kpis?.developerGrossProfit === null ? "Restricted" : money(kpis?.developerGrossProfit || 0, currency),
      note: kpis?.marginPercent === null ? "Manager and finance access" : `${kpis?.marginPercent || 0}% gross margin`,
      icon: TrendingUp,
    },
    { label: "Agency income", value: money(kpis?.agencyCommission || 0, currency), note: "Earned commission", icon: BadgeIndianRupee },
    { label: "Collections", value: money(kpis?.collections || 0, currency), note: "Confirmed receipts", icon: BanknoteArrowDown },
    { label: "Cancellations", value: String(kpis?.cancellations || 0), note: "Audited reversals", icon: RotateCcw },
  ]

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-5 border-b border-black/10 pb-7 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Management command centre</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-6xl">Sales, profit and inventory—today.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Agreement-recognized sales, deal margin, collections, cancellations and team performance from auditable records.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold">From<Input className="mt-1 w-40" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="text-xs font-semibold">To<Input className="mt-1 w-40" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <Button asChild><Link to="/sales">Open sales desk</Link></Button>
        </div>
      </section>

      {summary.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-36 rounded-xl" />)}</div>
      ) : summary.isError ? (
        <Card><CardContent className="p-8"><CardTitle>Management reporting is unavailable</CardTitle><p className="mt-2 text-sm text-muted-foreground">{errorMessage(summary.error)}</p><Button className="mt-4" variant="outline" onClick={() => summary.refetch()}>Retry</Button></CardContent></Card>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <Card key={card.label} className="border-black/10 bg-white">
                <CardContent className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{card.label}</p>
                    <p className="mt-2 font-display text-3xl tabular-nums">{card.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>
                  </div>
                  <div className="rounded-full bg-black p-2.5 text-white"><card.icon className="size-4" /></div>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <Card className="border-black/10 bg-white">
              <CardHeader><CardTitle>Daily sales and collections</CardTitle><CardDescription>Every chart point reconciles with the deal rows below.</CardDescription></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.data?.daily || []} margin={{ left: 0, right: 10 }}>
                    <CartesianGrid stroke="#e6e6e2" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => money(Number(value), currency)} />
                    <Line type="monotone" dataKey="netSales" name="Net sales" stroke="#0a0a0a" strokeWidth={2.5} />
                    <Line type="monotone" dataKey="collections" name="Collections" stroke="#737373" strokeDasharray="5 4" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-black/10 bg-white">
              <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="size-5" /> Agent leaderboard</CardTitle><CardDescription>Executed sales for the selected period.</CardDescription></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.data?.agentLeaderboard || []} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid stroke="#e6e6e2" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="agentName" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => money(Number(value), currency)} />
                    <Bar dataKey="netSales" name="Net sales" fill="#0a0a0a" radius={[0, 5, 5, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          <Card className="border-black/10 bg-white">
            <CardHeader><CardTitle>Executed agreements</CardTitle><CardDescription>The exact deals included in the headline totals.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Deal</TableHead><TableHead>Property</TableHead><TableHead>Unit</TableHead><TableHead>Agent</TableHead><TableHead className="text-right">Net sale</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(summary.data?.deals || []).map((deal) => (
                    <TableRow key={deal.id}>
                      <TableCell className="font-mono text-xs">{deal.dealNumber}</TableCell>
                      <TableCell><p className="font-semibold">{deal.projectName}</p><p className="text-xs text-muted-foreground">{deal.structureName}</p></TableCell>
                      <TableCell className="font-semibold">{deal.unitNumber}</TableCell>
                      <TableCell>{deal.agentName}</TableCell>
                      <TableCell className="text-right font-semibold">{money(deal.netSaleValue, currency)}</TableCell>
                      <TableCell><Badge className="bg-emerald-600">Executed</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!summary.data?.deals.length && <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No executed agreements in this period.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

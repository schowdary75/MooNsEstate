import { useQueries, useQuery } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowDown,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClockAlert,
  Sparkles,
  Target,
  TrendingDown,
} from "lucide-react"
import { Link } from "react-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getAnalytics, listRecords } from "./api"
import type { CrmRecord } from "./types"
import { displayValue, recordId } from "./types"

const recentModules = [
  { label: "Leads", endpoint: "lead", path: "/leads" },
  { label: "Contacts", endpoint: "contact", path: "/contacts" },
  { label: "Properties", endpoint: "property", path: "/properties" },
  { label: "Opportunities", endpoint: "opportunity", path: "/opportunities" },
]

const titleFor = (record: CrmRecord) =>
  displayValue(record.leadName || record.fullName || record.propertyAddress || record.opportunityName || record.name || record.title)

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)

const chartTooltipStyle = {
  border: "1px solid #d9d9d4",
  borderRadius: "10px",
  background: "#fff",
  color: "#0a0a0a",
  boxShadow: "0 16px 40px rgba(0,0,0,.08)",
  fontSize: "12px",
}

export function DashboardPage() {
  const analytics = useQuery({
    queryKey: ["analytics"],
    queryFn: getAnalytics,
  })
  const recentQueries = useQueries({
    queries: recentModules.map((module) => ({
      queryKey: ["records", module.endpoint],
      queryFn: () => listRecords(module.endpoint),
    })),
  })

  const recent = recentQueries
    .flatMap((query, index) => (query.data || []).slice(0, 3).map((record) => ({ record, module: recentModules[index] })))
    .sort((a, b) => String(b.record.createdDate || "").localeCompare(String(a.record.createdDate || "")))
    .slice(0, 6)

  const kpis = analytics.data?.kpis
  const cards = [
    { label: "Active leads", value: kpis?.leads ?? 0, path: "/leads", icon: Sparkles, note: "Seller and buyer enquiries" },
    { label: "Properties", value: kpis?.properties ?? 0, path: "/properties", icon: Building2, note: "Managed inventory" },
    { label: "Open pipeline", value: money(kpis?.openPipelineValue ?? 0), path: "/pipeline", icon: CircleDollarSign, note: `${kpis?.opportunities ?? 0} active opportunities` },
    { label: "Overdue tasks", value: kpis?.overdueTasks ?? 0, path: "/tasks", icon: ClockAlert, note: "Requires follow-up" },
  ]
  const hasTrendActivity = Boolean(analytics.data?.monthlyTrend.some((point) => point.leads > 0 || point.opportunities > 0))
  const hasPipelineActivity = Boolean(analytics.data?.pipeline.some((point) => point.count > 0))
  const funnel = analytics.data?.funnel || []
  const funnelMaximum = Math.max(1, funnel[0]?.value || 0)
  const funnelStages = funnel.map((item, index) => {
    const previousValue = index > 0 ? funnel[index - 1]?.value || 0 : item.value
    const difference = item.value - previousValue

    return {
      ...item,
      share: Math.round((item.value / funnelMaximum) * 100),
      difference,
      dropRate: previousValue > 0 && difference < 0
        ? Math.round((Math.abs(difference) / previousValue) * 100)
        : 0,
    }
  })
  const wonStage = funnelStages.find((item) => item.stage.toLowerCase().includes("won")) || funnelStages.at(-1)
  const leadToWinRate = Math.round(((wonStage?.value || 0) / funnelMaximum) * 100)
  const biggestDrop = funnelStages
    .slice(1)
    .filter((item) => item.difference < 0)
    .sort((left, right) => left.difference - right.difference)[0]
  const stageTones = [
    "border-black bg-black text-white",
    "border-[#282925] bg-[#282925] text-white",
    "border-[#686b63] bg-[#686b63] text-white",
    "border-emerald-700 bg-emerald-600 text-white",
  ]

  return (
    <div className="space-y-8">
      <section className="grid gap-6 border-b border-black/15 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Portfolio intelligence</p>
          <h2 className="mt-2 max-w-4xl font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            The whole business, in one clear view.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            Live pipeline, acquisition, inventory, and revenue signals calculated from your CRM records.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {new Intl.DateTimeFormat("en-IN", { dateStyle: "full" }).format(new Date())}
          </p>
          <Button asChild size="sm"><Link to="/pipeline"><Target /> Open deal pipeline</Link></Button>
        </div>
      </section>

      {analytics.isError && (
        <Card className="border-black bg-white">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="font-semibold">Analytics could not be loaded.</p>
              <p className="text-sm text-muted-foreground">The CRM data routes remain available while reporting reconnects.</p>
            </div>
            <Button variant="outline" onClick={() => analytics.refetch()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card className="editorial-shadow group border-black/10 bg-white" key={card.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="grid size-10 place-items-center rounded-full border border-black/15 bg-muted">
                  <card.icon className="size-4" />
                </div>
                <Button asChild size="icon" variant="ghost">
                  <Link to={card.path} aria-label={`Open ${card.label}`}><ArrowUpRight /></Link>
                </Button>
              </div>
              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{card.label}</p>
              {analytics.isPending ? <Skeleton className="mt-2 h-10 w-24" /> : (
                <p className="mt-1 font-display text-4xl tabular-nums">{card.value}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{card.note}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-label="Analytics charts" className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="editorial-shadow border-black/10 bg-white">
          <CardHeader className="flex-row items-start justify-between gap-5 space-y-0">
            <div>
              <CardTitle className="font-display text-2xl">Acquisition trend</CardTitle>
              <CardDescription>New leads and opportunities created during the last six months.</CardDescription>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Conversion</p>
              <p className="mt-1 font-display text-2xl tabular-nums">{kpis?.conversionRate ?? 0}%</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative h-72" aria-label="Six month lead and opportunity trend">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.data?.monthlyTrend || []} margin={{ left: -18, right: 8, top: 10 }}>
                  <defs>
                    <linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0a0a0a" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#0a0a0a" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e6e6e2" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#666663", fontSize: 11 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#666663", fontSize: 11 }} />
                  <ChartTooltip contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke="#0a0a0a" strokeWidth={2} fill="url(#leadFill)" />
                  <Area type="monotone" dataKey="opportunities" name="Opportunities" stroke="#777770" strokeWidth={2} strokeDasharray="5 4" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
              {!analytics.isPending && !hasTrendActivity && (
                <p className="pointer-events-none absolute bottom-3 left-3 rounded border border-black/10 bg-white/95 px-2 py-1 text-xs text-muted-foreground">
                  No live acquisition activity yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="editorial-shadow border-black/10 bg-white">
          <CardHeader className="flex-row items-start justify-between gap-5 space-y-0">
            <div>
              <CardTitle className="font-display text-2xl">Pipeline by stage</CardTitle>
              <CardDescription>Current opportunity volume, grouped by selling stage.</CardDescription>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Paid revenue</p>
              <p className="mt-1 font-display text-xl tabular-nums">{money(kpis?.paidRevenue ?? 0)}</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative h-72" aria-label="Opportunity pipeline by stage">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.data?.pipeline || []} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid stroke="#e6e6e2" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#666663", fontSize: 11 }} />
                  <YAxis type="category" dataKey="stage" width={88} axisLine={false} tickLine={false} tick={{ fill: "#333330", fontSize: 10 }} />
                  <ChartTooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="count" name="Deals" fill="#0a0a0a" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {!analytics.isPending && !hasPipelineActivity && (
                <p className="pointer-events-none absolute bottom-3 left-3 rounded border border-black/10 bg-white/95 px-2 py-1 text-xs text-muted-foreground">
                  No live opportunities in the pipeline yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
        <Card className="editorial-shadow overflow-hidden border-black/10 bg-[#f4f4ef]">
          <CardHeader className="relative overflow-hidden border-b border-white/10 bg-black px-6 py-6 text-white sm:px-7">
            <div className="pointer-events-none absolute inset-0 opacity-80 [background:radial-gradient(circle_at_84%_0%,rgba(16,185,129,0.35),transparent_32%),radial-gradient(circle_at_5%_120%,rgba(255,255,255,0.16),transparent_38%)]" />
            <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
                  Pipeline intelligence
                </div>
                <CardTitle className="font-display text-3xl sm:text-4xl">Conversion journey</CardTitle>
                <CardDescription className="mt-2 max-w-lg text-white/55">
                  See momentum, stage leakage, and the shortest path to more closures.
                </CardDescription>
              </div>
              <div className="w-fit rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3 backdrop-blur">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">Lead to win</p>
                <div className="mt-1 flex items-end gap-2">
                  <p className="font-display text-4xl leading-none tabular-nums">{leadToWinRate}%</p>
                  <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                    <CheckCircle2 className="size-3" /> live
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-7">
            {analytics.isPending ? (
              <div className="space-y-3">
                {[100, 91, 82, 73].map((width) => (
                  <Skeleton className="mx-auto h-20 rounded-2xl" key={width} style={{ width: `${width}%` }} />
                ))}
              </div>
            ) : !funnelStages.length ? (
              <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-black/15 bg-white/55 p-8 text-center">
                <div>
                  <Target className="mx-auto size-7 text-muted-foreground" />
                  <p className="mt-3 font-semibold">Your conversion journey starts here.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Add leads and opportunities to reveal stage performance.</p>
                </div>
              </div>
            ) : (
              <>
                <div aria-label="Lead conversion stages" className="relative">
                  <div className="pointer-events-none absolute bottom-8 left-1/2 top-8 w-px -translate-x-1/2 bg-black/10" />
                  {funnelStages.map((item, index) => {
                    const stageWidth = Math.max(70, 100 - index * 9)
                    const tone = stageTones[Math.min(index, stageTones.length - 1)]

                    return (
                      <div className="relative" key={item.stage}>
                        {index > 0 && (
                          <div className="relative z-10 flex h-9 items-center justify-center">
                            <span className="flex items-center gap-1.5 rounded-full border border-black/10 bg-[#f4f4ef] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                              <ArrowDown className="size-3" />
                              {item.difference < 0
                                ? `${Math.abs(item.difference)} left · ${item.dropRate}% drop`
                                : item.difference > 0
                                  ? `+${item.difference} entered at stage`
                                  : "No stage loss"}
                            </span>
                          </div>
                        )}
                        <div
                          className={`relative z-10 mx-auto overflow-hidden rounded-2xl border px-4 py-4 shadow-[0_12px_35px_rgba(0,0,0,0.10)] transition-transform duration-300 hover:-translate-y-0.5 sm:px-5 ${tone}`}
                          style={{ width: `${stageWidth}%` }}
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold tracking-[0.18em] opacity-55">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-3">
                                <p className="truncate text-sm font-semibold sm:text-base">{item.stage}</p>
                                <p className="font-display text-3xl leading-none tabular-nums">{item.value}</p>
                              </div>
                              <div className="mt-3 flex items-center gap-3">
                                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                                  <div
                                    className="h-full rounded-full bg-white/85"
                                    style={{ width: `${Math.max(item.value ? 4 : 0, item.share)}%` }}
                                  />
                                </div>
                                <span className="w-11 text-right text-[10px] font-bold tabular-nums opacity-70">
                                  {item.share}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6 grid gap-3 border-t border-black/10 pt-5 sm:grid-cols-2">
                  <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      <TrendingDown className="size-3.5 text-amber-600" /> Biggest leakage
                    </div>
                    <p className="mt-2 text-sm font-semibold">
                      {biggestDrop
                        ? `${funnelStages[funnelStages.indexOf(biggestDrop) - 1]?.stage} → ${biggestDrop.stage}`
                        : "No stage leakage detected"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {biggestDrop
                        ? `${Math.abs(biggestDrop.difference)} prospects were lost at this transition.`
                        : "Every prospect is currently moving forward."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800">
                      <Sparkles className="size-3.5" /> Conversion signal
                    </div>
                    <p className="mt-2 text-sm font-semibold text-emerald-950">
                      {wonStage?.value || 0} closed from {funnelStages[0]?.value || 0} leads
                    </p>
                    <p className="mt-1 text-xs leading-5 text-emerald-900/65">
                      Focus follow-ups on the largest drop to protect near-term revenue.
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="editorial-shadow border-black/10 bg-black text-white">
          <CardHeader className="border-b border-white/15">
            <CardTitle className="font-display text-2xl">Recent records</CardTitle>
            <CardDescription className="text-white/55">The newest additions across the workspace.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!recent.length ? (
              <p className="p-6 text-sm text-white/55">Recent activity will appear as records are added.</p>
            ) : recent.map(({ record, module }) => (
              <Link
                to={module.path}
                key={`${module.endpoint}-${recordId(record)}`}
                className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 transition-colors last:border-0 hover:bg-white/10"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{titleFor(record)}</p>
                  <p className="mt-1 text-xs text-white/45">{module.label}</p>
                </div>
                <Badge variant="outline" className="border-white/25 text-white">View</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

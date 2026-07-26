import { useQuery } from "@tanstack/react-query"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Download, Printer, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getAnalytics } from "./api"

const grayScale = ["#0a0a0a", "#353532", "#5c5c57", "#85857f", "#aeaea8", "#d1d1cc", "#e6e6e2", "#f2f2ef"]
const tooltipStyle = {
  border: "1px solid #d9d9d4",
  borderRadius: "10px",
  background: "#fff",
  color: "#0a0a0a",
  fontSize: "12px",
}

export function ReportsPage() {
  const analytics = useQuery({ queryKey: ["analytics"], queryFn: getAnalytics })

  const exportReport = () => {
    if (!analytics.data) return
    const file = new Blob([JSON.stringify(analytics.data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(file)
    const link = document.createElement("a")
    link.href = url
    link.download = `moonestate-report-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (analytics.isPending) {
    return <div className="grid gap-6 lg:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-80 rounded-xl" />)}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-black/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Business intelligence</p>
          <h2 className="mt-1 font-display text-4xl tracking-tight sm:text-5xl">Reports & analytics</h2>
          <p className="mt-2 text-sm text-muted-foreground">Live performance reporting generated from CRM records.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" onClick={() => analytics.refetch()}><RefreshCw /> Refresh</Button>
          <Button variant="outline" onClick={exportReport} disabled={!analytics.data}><Download /> Export data</Button>
          <Button onClick={() => window.print()}><Printer /> Print report</Button>
        </div>
      </div>

      {analytics.isError ? (
        <Card><CardContent className="grid min-h-64 place-items-center p-8 text-center">
          <div><CardTitle>Reporting is temporarily unavailable.</CardTitle><Button className="mt-4" variant="outline" onClick={() => analytics.refetch()}>Try again</Button></div>
        </CardContent></Card>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Lead conversion", `${analytics.data?.kpis.conversionRate || 0}%`],
              ["Open pipeline", new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact" }).format(analytics.data?.kpis.openPipelineValue || 0)],
              ["Paid revenue", new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact" }).format(analytics.data?.kpis.paidRevenue || 0)],
              ["Overdue tasks", analytics.data?.kpis.overdueTasks || 0],
            ].map(([label, value]) => (
              <Card key={label} className="border-black/10 bg-white">
                <CardContent className="p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                  <p className="mt-2 font-display text-4xl">{value}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card className="border-black/10 bg-white">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Pipeline value</CardTitle>
                <CardDescription>Total opportunity value at each stage.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.data?.pipeline || []} margin={{ left: 4, right: 10, bottom: 28 }}>
                      <CartesianGrid stroke="#e6e6e2" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="stage" angle={-25} textAnchor="end" axisLine={false} tickLine={false} tick={{ fill: "#666663", fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#666663", fontSize: 10 }} />
                      <ChartTooltip contentStyle={tooltipStyle} formatter={(value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value))} />
                      <Bar dataKey="value" name="Pipeline value" fill="#0a0a0a" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-black/10 bg-white">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Lead source mix</CardTitle>
                <CardDescription>Acquisition volume by originating channel.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytics.data?.leadSources || []} dataKey="count" nameKey="source" innerRadius={64} outerRadius={105} paddingAngle={2}>
                        {(analytics.data?.leadSources || []).map((item, index) => <Cell key={item.source} fill={grayScale[index % grayScale.length]} />)}
                      </Pie>
                      <ChartTooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-black/10 bg-white xl:col-span-2">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Six-month performance</CardTitle>
                <CardDescription>Lead creation, opportunity creation, and paid revenue trend.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.data?.monthlyTrend || []} margin={{ left: -18, right: 10 }}>
                      <CartesianGrid stroke="#e6e6e2" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#666663", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#666663", fontSize: 11 }} />
                      <ChartTooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="leads" name="Leads" stroke="#0a0a0a" strokeWidth={2.5} dot={{ r: 3, fill: "#0a0a0a" }} />
                      <Line type="monotone" dataKey="opportunities" name="Opportunities" stroke="#777770" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}

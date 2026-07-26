import { useMutation, useQuery } from "@tanstack/react-query"
import { Check, CreditCard, Gauge, Users } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api, errorMessage } from "./api"

type Plan = {
  id: string
  code: string
  name: string
  description?: string | null
  currency: string
  monthlyPrice: string | number
  annualPrice: string | number
  includedSeats: number
  includedLeads: number
  includedMessages: number
  includedTranscriptionMinutes: number
}

type BillingSummary = {
  subscription?: { id: string; status: string; provider: string; trialEndsAt?: string | null; graceEndsAt?: string | null; plan: Plan } | null
  usage: Array<{ usageType: string; quantity: string | number }>
}

const price = (value: string | number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value))

export function BillingPage() {
  const plans = useQuery<Plan[]>({
    queryKey: ["billing-plans"],
    queryFn: async () => (await api.get("/v1/billing/plans")).data.data,
  })
  const summary = useQuery<BillingSummary>({
    queryKey: ["billing-subscription"],
    queryFn: async () => (await api.get("/v1/billing/subscription")).data.data,
  })
  const checkout = useMutation({
    mutationFn: (planId: string) => api.post("/v1/billing/checkout", {
      planId,
      interval: "monthly",
      provider: "razorpay",
    }),
    onSuccess: (response) => {
      const url = response.data.data?.checkoutUrl
      if (url) window.location.assign(url)
      else toast.info("Razorpay checkout created. Open it with the returned subscription ID.")
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const active = summary.data?.subscription
  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">SaaS Billing</p>
          <h1 className="font-display text-3xl font-bold">Plan and usage</h1>
          <p className="mt-1 text-sm text-muted-foreground">Razorpay is the INR default; Stripe remains available for international workspaces.</p>
        </div>
        {active && (
          <Card className="min-w-72">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Current plan</p>
                <p className="font-semibold">{active.plan.name}</p>
              </div>
              <Badge className="capitalize">{active.status}</Badge>
            </CardContent>
          </Card>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {(plans.data || []).map((plan) => {
          const selected = active?.plan.id === plan.id
          return (
            <Card key={plan.id} className={selected ? "border-2 border-black" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div><CardTitle>{plan.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{plan.description}</p></div>
                  {selected && <Badge>Current</Badge>}
                </div>
                <p className="pt-3 text-3xl font-semibold">{price(plan.monthlyPrice)}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  `${plan.includedSeats} included seats`,
                  `${plan.includedLeads.toLocaleString("en-IN")} leads`,
                  `${plan.includedMessages.toLocaleString("en-IN")} outbound messages`,
                  `${plan.includedTranscriptionMinutes.toLocaleString("en-IN")} transcription minutes`,
                ].map((feature) => <p key={feature} className="flex items-center gap-2 text-sm"><Check className="size-4 text-emerald-600" /> {feature}</p>)}
                <Button variant={selected ? "outline" : "default"} className="w-full" disabled={selected || checkout.isPending} onClick={() => checkout.mutate(plan.id)}>
                  <CreditCard className="size-4" /> {selected ? "Active plan" : "Choose with Razorpay"}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Seats", value: summary.data?.usage.find((item) => item.usageType === "seat")?.quantity || 0, icon: Users },
          { label: "Messages", value: summary.data?.usage.find((item) => String(item.usageType).includes("outbound"))?.quantity || 0, icon: Gauge },
          { label: "Transcription minutes", value: summary.data?.usage.find((item) => item.usageType === "transcription_minute")?.quantity || 0, icon: CreditCard },
        ].map((item) => (
          <Card key={item.label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs uppercase text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-semibold">{String(item.value)}</p></div><item.icon className="size-5" /></CardContent></Card>
        ))}
      </div>
    </div>
  )
}

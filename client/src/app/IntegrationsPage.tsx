import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { CheckCircle2, CircleAlert, GitMerge, KeyRound, Save } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, errorMessage } from "./api"

const providerFields: Record<string, Array<{ key: string; label: string; secret?: boolean; placeholder?: string }>> = {
  meta: [
    { key: "accessToken", label: "System user access token", secret: true },
    { key: "pageId", label: "Facebook Page ID" },
    { key: "adAccountId", label: "Ad Account ID", placeholder: "act_…" },
    { key: "phoneNumberId", label: "WhatsApp Phone Number ID" },
    { key: "wabaId", label: "WhatsApp Business Account ID" },
    { key: "datasetId", label: "Conversions API Dataset ID" },
  ],
  resend: [
    { key: "apiKey", label: "Resend API key", secret: true },
    { key: "webhookSecret", label: "Webhook signing secret", secret: true },
    { key: "fromEmail", label: "Verified sender", placeholder: "sales@example.com" },
    { key: "inboundDomain", label: "Inbound email domain", placeholder: "reply.example.com" },
  ],
  exotel: [
    { key: "accountSid", label: "Account SID" },
    { key: "apiKey", label: "API key", secret: true },
    { key: "apiToken", label: "API token", secret: true },
    { key: "callerId", label: "Exotel virtual number" },
    { key: "callbackToken", label: "Callback verification token", secret: true },
    { key: "region", label: "Region", placeholder: "mumbai" },
  ],
  sarvam: [
    { key: "apiKey", label: "Sarvam subscription key", secret: true },
    { key: "callbackToken", label: "Callback verification token", secret: true },
  ],
  razorpay: [
    { key: "keyId", label: "Razorpay key ID" },
    { key: "keySecret", label: "Razorpay key secret", secret: true },
    { key: "webhookSecret", label: "Webhook secret", secret: true },
  ],
  stripe: [
    { key: "secretKey", label: "Stripe secret key", secret: true },
    { key: "webhookSecret", label: "Webhook signing secret", secret: true },
  ],
  storage: [
    { key: "endpoint", label: "S3 / MinIO endpoint" },
    { key: "region", label: "Region" },
    { key: "bucket", label: "Private bucket" },
    { key: "accessKeyId", label: "Access key ID", secret: true },
    { key: "secretAccessKey", label: "Secret access key", secret: true },
  ],
}

const providerLabels: Record<string, string> = {
  meta: "Meta Business + WhatsApp",
  resend: "Resend Email",
  exotel: "Exotel Calling",
  sarvam: "Sarvam AI Transcription",
  razorpay: "Razorpay Billing",
  stripe: "Stripe Billing",
  storage: "S3 / MinIO Storage",
}

type ReconciliationItem = {
  id: string
  channel: string
  identifier: string
  createdDate: string
  candidates: Array<{
    id: string
    leadName?: string | null
    leadEmail?: string | null
    leadPhoneNumber?: string | null
  }>
}

export function IntegrationsPage() {
  const [selected, setSelected] = useState("meta")
  const [config, setConfig] = useState<Record<string, string>>({})
  const integrations = useQuery<Array<{ provider: string; status: string; externalAccountId?: string | null; lastSyncAt?: string | null; lastError?: string | null }>>({
    queryKey: ["integrations"],
    queryFn: async () => (await api.get("/v1/integrations")).data.data,
  })
  const reconciliation = useQuery<ReconciliationItem[]>({
    queryKey: ["reconciliation", "pending"],
    queryFn: async () => (await api.get("/v1/reconciliation", { params: { status: "pending" } })).data.data,
  })

  const current = useMemo(
    () => integrations.data?.find((item) => item.provider === selected),
    [integrations.data, selected],
  )

  const save = useMutation({
    mutationFn: () => api.put(`/v1/integrations/${selected}`, {
      config,
      externalAccountId: config.pageId || config.accountSid || config.fromEmail || undefined,
    }),
    onSuccess: () => {
      toast.success(`${providerLabels[selected]} credentials encrypted and saved`)
      setConfig({})
      void integrations.refetch()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const resolveReconciliation = useMutation({
    mutationFn: ({ itemId, leadId }: { itemId: string; leadId: string }) =>
      api.post(`/v1/reconciliation/${itemId}/resolve`, { leadId }),
    onSuccess: () => {
      toast.success("Conversation matched to the selected lead")
      void reconciliation.refetch()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Administration</p>
        <h1 className="font-display text-3xl font-bold">Integration health</h1>
        <p className="mt-1 text-sm text-muted-foreground">Secrets are encrypted server-side and are never returned to this browser.</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {(integrations.data || Object.keys(providerFields).map((provider) => ({ provider, status: "setup_required" }))).map((item) => (
            <button
              key={item.provider}
              className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${selected === item.provider ? "border-black bg-black text-white" : "bg-white hover:border-black/30"}`}
              onClick={() => {
                setSelected(item.provider)
                setConfig({})
              }}
            >
              <span className="font-semibold">{providerLabels[item.provider]}</span>
              {item.status === "configured" ? <CheckCircle2 className="size-4 text-emerald-400" /> : <CircleAlert className="size-4 text-amber-500" />}
            </button>
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{providerLabels[selected]}</CardTitle>
                <CardDescription>Enter or rotate credentials. Existing secret values remain hidden.</CardDescription>
              </div>
              <Badge variant="outline" className="capitalize">{current?.status || "setup_required"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {current?.lastError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{current.lastError}</div>}
            <div className="grid gap-4 sm:grid-cols-2">
              {(providerFields[selected] || []).map((field) => (
                <div key={field.key}>
                  <Label htmlFor={`${selected}-${field.key}`}>{field.label}</Label>
                  <div className="relative">
                    {field.secret && <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />}
                    <Input
                      id={`${selected}-${field.key}`}
                      type={field.secret ? "password" : "text"}
                      value={config[field.key] || ""}
                      onChange={(event) => setConfig((value) => ({ ...value, [field.key]: event.target.value }))}
                      placeholder={field.placeholder || (field.secret ? "Enter a new secret value" : "")}
                      className={field.secret ? "pl-9" : ""}
                      autoComplete="off"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => save.mutate()} disabled={save.isPending || Object.keys(config).length === 0}>
                <Save className="size-4" /> {save.isPending ? "Encrypting…" : "Save integration"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><GitMerge className="size-5" /> Conversation reconciliation</CardTitle>
              <CardDescription>
                Ambiguous inbound identities stay here until a team member confirms the correct lead.
              </CardDescription>
            </div>
            <Badge variant="secondary">{reconciliation.data?.length || 0} pending</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!reconciliation.data?.length ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No WhatsApp or email conversations require reconciliation.
            </div>
          ) : reconciliation.data.map((item) => (
            <div key={item.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold capitalize">{item.channel} · {item.identifier}</p>
                  <p className="text-xs text-muted-foreground">Received {new Date(item.createdDate).toLocaleString("en-IN")}</p>
                </div>
                <Badge variant="outline">{item.candidates.length} candidates</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.candidates.map((candidate) => (
                  <Button
                    key={candidate.id}
                    size="sm"
                    variant="outline"
                    disabled={resolveReconciliation.isPending}
                    onClick={() => resolveReconciliation.mutate({ itemId: item.id, leadId: candidate.id })}
                  >
                    Match {candidate.leadName || candidate.leadEmail || candidate.leadPhoneNumber || "lead"}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

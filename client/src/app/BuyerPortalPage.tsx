import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Heart,
  IndianRupee,
  LogIn,
  MapPin,
  MessageSquare,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Textarea } from "@/components/ui/textarea"
import { api, errorMessage } from "./api"
import { PropertyLeafletMap } from "./PropertyLeafletMap"
import type { CrmRecord } from "./types"
import { recordId } from "./types"

const workspace = "moon-estates"
const inr = (value: unknown) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0)

type PortalShortlist = {
  id: string
  items: Array<{ id: string; property: CrmRecord | null }>
}

type PortalVisit = CrmRecord & {
  property?: CrmRecord | null
}

type PortalMessage = CrmRecord & {
  conversation?: { channel?: string; subject?: string | null }
}

export function BuyerPortalPage() {
  const [search, setSearch] = useState("")
  const [propertyType, setPropertyType] = useState("all")
  const [bedrooms, setBedrooms] = useState("all")
  const [budgetMax, setBudgetMax] = useState("")
  const [selected, setSelected] = useState<CrmRecord | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [previewLink, setPreviewLink] = useState("")
  const [visitDate, setVisitDate] = useState("")
  const [phone, setPhone] = useState("")
  const [inquiry, setInquiry] = useState("")
  const [consent, setConsent] = useState(false)

  const buyer = useQuery<CrmRecord | null>({
    queryKey: ["buyer-me"],
    retry: false,
    queryFn: async () => (await api.get("/v1/portal/me")).data.data,
  })

  const properties = useQuery<CrmRecord[]>({
    queryKey: ["public-properties", search, propertyType, bedrooms, budgetMax],
    queryFn: async () => {
      const params = new URLSearchParams({ workspace, search })
      if (propertyType !== "all") params.set("propertyType", propertyType)
      if (bedrooms !== "all") params.set("bedrooms", bedrooms)
      if (budgetMax) params.set("budgetMax", budgetMax)
      const response = await api.get(`/v1/public/properties?${params.toString()}`)
      return response.data.data
    },
  })
  const shortlists = useQuery<PortalShortlist[]>({
    queryKey: ["portal-shortlists"],
    enabled: Boolean(buyer.data),
    queryFn: async () => (await api.get("/v1/portal/shortlists")).data.data,
  })
  const visits = useQuery<PortalVisit[]>({
    queryKey: ["portal-site-visits"],
    enabled: Boolean(buyer.data),
    queryFn: async () => (await api.get("/v1/portal/site-visits")).data.data,
  })
  const communications = useQuery<PortalMessage[]>({
    queryKey: ["portal-communications"],
    enabled: Boolean(buyer.data),
    queryFn: async () => (await api.get("/v1/portal/communications")).data.data,
  })

  const passwordless = useMutation({
    mutationFn: () => api.post("/v1/public/auth/passwordless/start", { workspace, email, fullName }),
    onSuccess: (response) => {
      const data = response.data.data
      setPreviewLink(data.previewLink || "")
      toast.success(data.status === "sent" ? "Magic link sent to your email" : "Development sign-in link created")
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const protectedAction = (action: () => void) => {
    if (!buyer.data) {
      setAuthOpen(true)
      return
    }
    action()
  }

  const shortlist = useMutation({
    mutationFn: (propertyId: string) => api.post("/v1/portal/shortlists/items", { propertyId }),
    onSuccess: () => {
      toast.success("Property added to your shortlist")
      void shortlists.refetch()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const siteVisit = useMutation({
    mutationFn: () => api.post("/v1/portal/site-visits", {
      propertyId: recordId(selected || {}),
      scheduledAt: visitDate,
      notes: "Requested from buyer portal",
    }),
    onSuccess: () => {
      toast.success("Site visit requested. Your advisor can now confirm it.")
      setVisitDate("")
      void visits.refetch()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const sendInquiry = useMutation({
    mutationFn: () => api.post("/v1/portal/inquiries", {
      propertyId: recordId(selected || {}),
      phone,
      message: inquiry,
      consentStatus: consent ? "granted" : "unknown",
    }),
    onSuccess: () => {
      toast.success("Callback request received and added to the sales desk")
      setInquiry("")
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-slate-950">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <div className="grid size-9 place-items-center rounded-full bg-black text-white">M</div>
          <div><p className="font-bold tracking-[0.18em]">MOON ESTATES</p><p className="text-[9px] text-muted-foreground">VERIFIED PROPERTY DISCOVERY</p></div>
          <Button className="ml-auto" variant="outline" onClick={() => setAuthOpen(true)}>
            <LogIn className="size-4" /> {buyer.data ? String(buyer.data.fullName || buyer.data.email) : "Buyer sign in"}
          </Button>
        </div>
      </header>

      <main>
        <section className="border-b bg-slate-950 text-white">
          <div className="mx-auto max-w-7xl px-4 py-16">
            <Badge className="bg-emerald-400 text-slate-950">Indian real estate, clearly presented</Badge>
            <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-tight sm:text-6xl">Find a verified home, not another confusing listing.</h1>
            <p className="mt-4 max-w-2xl text-slate-300">Compare actual availability, RERA details, carpet area, current pricing, maps and site visits in one secure buyer workspace.</p>
          </div>
        </section>

        {buyer.data && (
          <section className="border-b bg-white">
            <div className="mx-auto max-w-7xl px-4 py-8">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Your buyer workspace</p>
                <h2 className="font-display text-2xl font-bold">Shortlist, visits and advisor updates</h2>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Shortlist comparison</p>
                      <Heart className="size-4 text-rose-600" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {(shortlists.data?.flatMap((shortlist) => shortlist.items) || []).slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-lg border p-3">
                          <p className="truncate text-sm font-semibold">{String(item.property?.title || "Property")}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.property?.bedrooms ? `${item.property.bedrooms} BHK · ` : ""}
                            {item.property?.listingPrice ? inr(item.property.listingPrice) : "Price on request"}
                          </p>
                        </div>
                      ))}
                      {!shortlists.data?.some((shortlist) => shortlist.items.length) && (
                        <p className="text-sm text-muted-foreground">Save properties to compare them here.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Site visits</p>
                      <CalendarDays className="size-4 text-emerald-700" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {(visits.data || []).slice(0, 3).map((visit) => (
                        <div key={recordId(visit)} className="rounded-lg border p-3">
                          <p className="truncate text-sm font-semibold">{String(visit.property?.title || "Property visit")}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(String(visit.scheduledAt)).toLocaleString("en-IN")} · {String(visit.status || "scheduled")}
                          </p>
                        </div>
                      ))}
                      {!visits.data?.length && <p className="text-sm text-muted-foreground">No site visits requested yet.</p>}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Communication history</p>
                      <MessageSquare className="size-4 text-blue-700" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {(communications.data || []).slice(0, 3).map((message) => (
                        <div key={recordId(message)} className="rounded-lg border p-3">
                          <p className="text-xs font-semibold capitalize">
                            {String(message.conversation?.channel || "message")} · {String(message.status || "")}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {String(message.text || message.conversation?.subject || "Message update")}
                          </p>
                        </div>
                      ))}
                      {!communications.data?.length && (
                        <p className="text-sm text-muted-foreground">Advisor messages will appear after your profile is linked to a lead.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 py-8">
          <Card className="-mt-14 border-0 shadow-xl">
            <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_180px_140px_180px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search locality, project, builder or address" className="pl-9" />
              </div>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All property types</SelectItem>
                  <SelectItem value="Apartment">Apartment</SelectItem>
                  <SelectItem value="Villa">Villa</SelectItem>
                  <SelectItem value="Commercial">Commercial</SelectItem>
                  <SelectItem value="Land">Land</SelectItem>
                </SelectContent>
              </Select>
              <Select value={bedrooms} onValueChange={setBedrooms}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any BHK</SelectItem>
                  {[1, 2, 3, 4, 5].map((value) => <SelectItem key={value} value={String(value)}>{value} BHK</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} type="number" placeholder="Maximum budget ₹" />
            </CardContent>
          </Card>

          <div className="mt-8 flex items-center justify-between">
            <div><h2 className="font-display text-2xl font-bold">Available properties</h2><p className="text-sm text-muted-foreground">Only listings published by the workspace are shown.</p></div>
            <Badge variant="outline">{properties.data?.length || 0} matches</Badge>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {properties.isLoading ? (
              <Card className="col-span-full p-12 text-center">Loading verified inventory…</Card>
            ) : !properties.data?.length ? (
              <Card className="col-span-full border-dashed p-12 text-center">
                <Building2 className="mx-auto size-10 text-muted-foreground" />
                <p className="mt-3 font-semibold">No published properties match these filters</p>
                <p className="text-sm text-muted-foreground">Try widening your budget or property type.</p>
              </Card>
            ) : properties.data.map((property) => {
              const photos = Array.isArray(property.propertyPhotos) ? property.propertyPhotos as string[] : []
              return (
                <Card key={recordId(property)} className="group overflow-hidden border-0 shadow-md transition hover:-translate-y-1 hover:shadow-xl">
                  <button className="block w-full text-left" onClick={() => setSelected(property)}>
                    <div className="relative h-56 bg-slate-200">
                      {photos[0] ? <img src={photos[0]} alt={String(property.title || "Property")} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center"><Building2 className="size-12 text-slate-400" /></div>}
                      <Badge className="absolute left-3 top-3 bg-white text-black">{String(property.status || "Available")}</Badge>
                      {property.reraId && <Badge className="absolute right-3 top-3 bg-emerald-600"><CheckCircle2 className="mr-1 size-3" /> RERA</Badge>}
                    </div>
                    <CardContent className="space-y-3 p-5">
                      <div><h3 className="line-clamp-1 text-lg font-semibold">{String(property.title || "Property")}</h3><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3" /> {String(property.location || property.propertyAddress || "Location available on request")}</p></div>
                      <div className="flex items-end justify-between"><p className="text-2xl font-semibold">{inr(property.listingPrice)}</p><p className="text-sm">{String(property.bedrooms || "—")} BHK · {String(property.carpetArea || "—")} sq.ft.</p></div>
                    </CardContent>
                  </button>
                  <div className="flex gap-2 border-t p-3">
                    <Button variant="outline" className="flex-1" onClick={() => protectedAction(() => shortlist.mutate(recordId(property)))}><Heart className="size-4" /> Shortlist</Button>
                    <Button className="flex-1" onClick={() => setSelected(property)}>View details</Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      </main>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Passwordless buyer access</DialogTitle><DialogDescription>Receive a secure 15-minute magic link. No password is stored.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full name</Label><Input value={fullName} onChange={(event) => setFullName(event.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            {previewLink && <a className="block rounded-xl bg-amber-50 p-3 text-xs text-amber-800 underline" href={previewLink}>Open development magic link</a>}
          </div>
          <DialogFooter><Button onClick={() => passwordless.mutate()} disabled={passwordless.isPending}>{passwordless.isPending ? "Sending…" : "Email magic link"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{String(selected.title || "Property")}</DialogTitle>
                <DialogDescription>{String(selected.builder || "")} · {String(selected.reraId || "RERA details unavailable")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 lg:grid-cols-2">
                <PropertyLeafletMap
                  address={String(selected.propertyAddress || selected.location || "Mumbai")}
                  title={String(selected.title || "Property")}
                  price={selected.listingPrice as string}
                  bhk={selected.bedrooms as string}
                  carpetArea={selected.carpetArea as string}
                  builder={String(selected.builder || "")}
                  latitude={Number(selected.latitude) || undefined}
                  longitude={Number(selected.longitude) || undefined}
                  className="h-80 overflow-hidden rounded-2xl border"
                />
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Card><CardContent className="p-4"><IndianRupee className="size-4" /><p className="mt-2 text-xl font-semibold">{inr(selected.listingPrice)}</p><p className="text-xs text-muted-foreground">Updated {selected.priceUpdatedAt ? new Date(String(selected.priceUpdatedAt)).toLocaleDateString("en-IN") : "recently"}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><Building2 className="size-4" /><p className="mt-2 text-xl font-semibold">{String(selected.bedrooms || "—")} BHK</p><p className="text-xs text-muted-foreground">{String(selected.carpetArea || "—")} carpet sq.ft.</p></CardContent></Card>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{String(selected.description || "Ask the advisor for complete property details.")}</p>
                  <Button variant="outline" className="w-full" onClick={() => protectedAction(() => shortlist.mutate(recordId(selected)))}><Heart className="size-4" /> Add to shortlist</Button>
                </div>
              </div>
              <div className="grid gap-4 border-t pt-4 md:grid-cols-2">
                <section className="space-y-3 rounded-2xl bg-slate-50 p-4">
                  <h3 className="flex items-center gap-2 font-semibold"><CalendarDays className="size-4" /> Request a site visit</h3>
                  <Input type="datetime-local" value={visitDate} onChange={(event) => setVisitDate(event.target.value)} />
                  <Button className="w-full" onClick={() => protectedAction(() => siteVisit.mutate())} disabled={!visitDate || siteVisit.isPending}>Request visit</Button>
                </section>
                <section className="space-y-3 rounded-2xl bg-slate-50 p-4">
                  <h3 className="font-semibold">Request an advisor callback</h3>
                  <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 mobile number" />
                  <Textarea value={inquiry} onChange={(event) => setInquiry(event.target.value)} placeholder="Budget, move-in timing, questions…" />
                  <Label className="flex items-start gap-2 text-xs"><Checkbox checked={consent} onCheckedChange={(value) => setConsent(Boolean(value))} /> I consent to communication about this property.</Label>
                  <Button className="w-full" onClick={() => protectedAction(() => sendInquiry.mutate())} disabled={!inquiry.trim() || sendInquiry.isPending}>Request callback</Button>
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Building2, Mail, MapPin, Phone, Plus, ShieldCheck } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "./auth"
import { api, errorMessage } from "./api"

export type DeveloperProfile = {
  id: string
  name: string
  legalName?: string | null
  profileType: string
  reraRegistration?: string | null
  gstin?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  contactPerson?: string | null
  address?: string | null
  status: string
  notes?: string | null
  projectCount: number
}

const emptyForm = {
  name: "",
  legalName: "",
  profileType: "Developer",
  reraRegistration: "",
  gstin: "",
  website: "",
  email: "",
  phone: "",
  contactPerson: "",
  address: "",
  status: "Active",
  notes: "",
}

export function DevelopersPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canManage = ["platform_owner", "organization_owner", "organization_admin", "sales_manager"].includes(user?.role || "")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DeveloperProfile | null>(null)
  const [form, setForm] = useState(emptyForm)
  const developers = useQuery({
    queryKey: ["developers"],
    queryFn: async () => (await api.get<{ data: DeveloperProfile[] }>("/v1/developers")).data.data,
  })
  const save = useMutation({
    mutationFn: () => editing
      ? api.patch(`/v1/developers/${editing.id}`, form)
      : api.post("/v1/developers", form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["developers"] })
      setOpen(false)
      setEditing(null)
      setForm(emptyForm)
      toast.success(editing ? "Developer updated" : "Builder / developer onboarded")
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const startEdit = (developer: DeveloperProfile) => {
    setEditing(developer)
    setForm({
      name: developer.name,
      legalName: developer.legalName || "",
      profileType: developer.profileType,
      reraRegistration: developer.reraRegistration || "",
      gstin: developer.gstin || "",
      website: developer.website || "",
      email: developer.email || "",
      phone: developer.phone || "",
      contactPerson: developer.contactPerson || "",
      address: developer.address || "",
      status: developer.status,
      notes: developer.notes || "",
    })
    setOpen(true)
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Partner onboarding</p>
          <h1 className="mt-2 font-display text-4xl sm:text-6xl">Builders & developers.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Verified legal, RERA, tax and relationship details used when creating projects and property inventory.</p>
        </div>
        {canManage && <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true) }}><Plus /> Onboard builder / developer</Button>}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(developers.data || []).map((developer) => (
          <Card key={developer.id} className="border-black/10 bg-white">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-full bg-black p-2.5 text-white"><Building2 className="size-5" /></div>
                <Badge className={developer.status === "Active" ? "bg-emerald-600" : "bg-zinc-500"}>{developer.status}</Badge>
              </div>
              <CardTitle className="mt-3 font-display text-2xl">{developer.name}</CardTitle>
              <CardDescription>{developer.profileType} · {developer.legalName || "Legal name pending"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-zinc-50 p-3">
                <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Projects</p><strong>{developer.projectCount}</strong></div>
                <div><p className="text-[10px] font-bold uppercase text-muted-foreground">RERA</p><strong className="text-xs">{developer.reraRegistration || "Pending"}</strong></div>
              </div>
              {developer.contactPerson && <p><strong>Contact:</strong> {developer.contactPerson}</p>}
              {developer.email && <p className="flex items-center gap-2"><Mail className="size-3.5" /> {developer.email}</p>}
              {developer.phone && <p className="flex items-center gap-2"><Phone className="size-3.5" /> {developer.phone}</p>}
              {developer.address && <p className="flex items-start gap-2 text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" /> {developer.address}</p>}
              <div className="flex items-center justify-between border-t pt-3">
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" /> GSTIN {developer.gstin || "pending"}</span>
                {canManage && <Button size="sm" variant="outline" onClick={() => startEdit(developer)}>Edit profile</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {!developers.isPending && !developers.data?.length && <Card><CardContent className="grid min-h-64 place-items-center text-center"><div><Building2 className="mx-auto size-10 text-muted-foreground" /><CardTitle className="mt-3">No builders or developers onboarded</CardTitle><p className="mt-2 text-sm text-muted-foreground">Create the partner profile before assigning new projects.</p></div></CardContent></Card>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit builder / developer" : "Onboard builder / developer"}</DialogTitle><DialogDescription>Capture the legal identity, compliance registrations and primary relationship contact.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-3 sm:grid-cols-2">
            <Field label="Display name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Legal entity name"><Input value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} /></Field>
            <Field label="Profile type"><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.profileType} onChange={(event) => setForm({ ...form, profileType: event.target.value })}><option>Builder</option><option>Developer</option><option>Builder & Developer</option></select></Field>
            <Field label="Status"><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option><option>Suspended</option></select></Field>
            <Field label="RERA registration"><Input value={form.reraRegistration} onChange={(event) => setForm({ ...form, reraRegistration: event.target.value })} /></Field>
            <Field label="GSTIN"><Input value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value })} /></Field>
            <Field label="Contact person"><Input value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
            <Field label="Website"><Input type="url" placeholder="https://" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Registered address"><Textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Internal notes"><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Complete onboarding"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-xs font-semibold">{label}</Label>{children}</div>
}

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Grid3X3,
  Images,
  Layers3,
  Plus,
  Search,
  Sparkles,
  Tags,
  WalletCards,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

type Project = {
  id: string
  name: string
  builder?: string | null
  location?: string | null
  address?: string | null
  reraId?: string | null
  possessionDate?: string | null
  description?: string | null
  structureCount: number
  unitCount: number
  availableUnits: number
  soldUnits: number
  inventoryValue: number
}

type InventoryUnit = {
  id: string
  unitNumber: string
  unitType?: string | null
  bedrooms?: number | null
  carpetArea?: number | null
  facing?: string | null
  listingPrice?: string | number | null
  baseCost?: string | number | null
  status: string
}

type InventoryLevel = {
  id: string
  levelNumber: number
  label?: string | null
  units: InventoryUnit[]
}

type InventoryStructure = {
  id: string
  name: string
  kind: string
  totalLevels?: number | null
  levels: InventoryLevel[]
  unlevelledUnits: InventoryUnit[]
}

type InventoryResponse = {
  project: Project
  structures: InventoryStructure[]
}

type Overview = {
  project: Project
  totals: {
    structures: number
    levels: number
    units: number
    inventoryValue: number
    soldValue: number
    absorptionRate: number
  }
  byStatus: Record<string, number>
  structures: Array<InventoryStructure & { units: number; available: number }>
}

type Preview = {
  previewToken: string
  summary: { floors: number; units: number; conflicts: number; estimatedInventoryValue: number }
  warnings: string[]
  units: Array<InventoryUnit & { floorNumber: number | null; sequence: number; conflict?: unknown }>
}

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0))

const statusTone: Record<string, string> = {
  Available: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Hold: "border-amber-200 bg-amber-50 text-amber-800",
  Reserved: "border-sky-200 bg-sky-50 text-sky-800",
  Booked: "border-violet-200 bg-violet-50 text-violet-800",
  Sold: "border-black bg-black text-white",
  Blocked: "border-red-200 bg-red-50 text-red-800",
  Cancelled: "border-zinc-200 bg-zinc-100 text-zinc-600",
}

export function ProjectsPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canManage = ["platform_owner", "organization_owner", "organization_admin", "sales_manager"].includes(user?.role || "")
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [projectForm, setProjectForm] = useState({ name: "", developerId: "", builder: "", location: "", reraId: "" })
  const [generator, setGenerator] = useState({
    structureName: "Tower A",
    kind: "Tower",
    floorFrom: "1",
    floorTo: "20",
    unitsPerFloor: "4",
    pattern: "{floor}{sequence:02}",
    excludedFloors: "",
    unitType: "2 BHK",
    bedrooms: "2",
    carpetArea: "950",
    listingPrice: "",
    baseCost: "",
    facing: "East",
  })
  const [preview, setPreview] = useState<Preview | null>(null)

  const projects = useQuery({
    queryKey: ["operational-projects"],
    queryFn: async () => (await api.get<{ data: Project[] }>("/v1/projects")).data.data,
  })
  const developers = useQuery({
    queryKey: ["developers"],
    queryFn: async () => (await api.get<{ data: Array<{ id: string; name: string; status: string }> }>("/v1/developers")).data.data,
  })
  const selectedProject = projects.data?.find((project) => project.id === selectedProjectId)
  const overview = useQuery({
    queryKey: ["project-overview", selectedProjectId],
    enabled: Boolean(selectedProjectId),
    queryFn: async () => (await api.get<{ data: Overview }>(`/v1/projects/${selectedProjectId}/overview`)).data.data,
  })
  const inventory = useQuery({
    queryKey: ["project-inventory", selectedProjectId],
    enabled: Boolean(selectedProjectId),
    queryFn: async () => (await api.get<{ data: InventoryResponse }>(`/v1/projects/${selectedProjectId}/inventory`)).data.data,
  })
  const deals = useQuery({
    queryKey: ["deals", selectedProjectId],
    enabled: Boolean(selectedProjectId),
    queryFn: async () => (await api.get<{ data: Array<Record<string, unknown>> }>("/v1/deals", {
      params: { projectId: selectedProjectId },
    })).data.data,
  })

  const filteredProjects = useMemo(() => {
    const needle = search.toLowerCase().trim()
    if (!needle) return projects.data || []
    return (projects.data || []).filter((project) =>
      [project.name, project.builder, project.location, project.reraId].some((value) =>
        String(value || "").toLowerCase().includes(needle)))
  }, [projects.data, search])

  const createProject = useMutation({
    mutationFn: () => api.post("/v1/projects", {
      ...projectForm,
      developerId: projectForm.developerId || null,
      builder: projectForm.builder || null,
      location: projectForm.location || null,
      reraId: projectForm.reraId || null,
    }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["operational-projects"] })
      setCreateOpen(false)
      setSelectedProjectId(response.data.data.id)
      setProjectForm({ name: "", developerId: "", builder: "", location: "", reraId: "" })
      toast.success("Project created")
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const generationPayload = () => ({
    structure: {
      name: generator.structureName,
      kind: generator.kind,
      totalLevels: generator.kind === "PlotLayout" || generator.kind === "VillaPhase"
        ? null
        : Number(generator.floorTo),
    },
    floorRange: generator.kind === "PlotLayout" || generator.kind === "VillaPhase"
      ? null
      : { from: Number(generator.floorFrom), to: Number(generator.floorTo) },
    excludedFloors: generator.excludedFloors.split(",").map((value) => Number(value.trim())).filter(Number.isFinite),
    unitsPerFloor: Number(generator.unitsPerFloor),
    numbering: { pattern: generator.pattern, prefix: "", suffix: "" },
    unitTemplate: {
      unitType: generator.unitType || null,
      bedrooms: generator.bedrooms ? Number(generator.bedrooms) : null,
      carpetArea: generator.carpetArea ? Number(generator.carpetArea) : null,
      listingPrice: generator.listingPrice ? Number(generator.listingPrice) : null,
      baseCost: generator.baseCost ? Number(generator.baseCost) : null,
      facing: generator.facing || null,
      status: "Available",
    },
    exceptions: [],
  })

  const previewGeneration = useMutation({
    mutationFn: async () => (await api.post<{ data: Preview }>(
      `/v1/projects/${selectedProjectId}/inventory/generation-preview`,
      generationPayload(),
    )).data.data,
    onSuccess: setPreview,
    onError: (error) => toast.error(errorMessage(error)),
  })
  const commitGeneration = useMutation({
    mutationFn: () => api.post(`/v1/projects/${selectedProjectId}/inventory/generation-commit`, {
      previewToken: preview?.previewToken,
      idempotencyKey: crypto.randomUUID(),
      conflictPolicy: "reject",
    }),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["operational-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["project-overview", selectedProjectId] }),
        queryClient.invalidateQueries({ queryKey: ["project-inventory", selectedProjectId] }),
      ])
      setGeneratorOpen(false)
      setPreview(null)
      toast.success(`${response.data.data.createdUnitCount} units generated`)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  if (selectedProject) {
    const metrics = [
      ["Structures", overview.data?.totals.structures || 0],
      ["Floors / levels", overview.data?.totals.levels || 0],
      ["Total units", overview.data?.totals.units || 0],
      ["Available", overview.data?.byStatus.Available || 0],
      ["Sold", overview.data?.byStatus.Sold || 0],
      ["Absorption", `${overview.data?.totals.absorptionRate || 0}%`],
      ["Inventory value", money(overview.data?.totals.inventoryValue)],
      ["Sold value", money(overview.data?.totals.soldValue)],
    ]
    return (
      <div className="space-y-6">
        <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Button variant="ghost" className="-ml-3 mb-3" onClick={() => setSelectedProjectId("")}><ArrowLeft /> All projects</Button>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{selectedProject.builder || "Independent project"} · {selectedProject.reraId || "RERA not recorded"}</p>
            <h1 className="mt-1 font-display text-4xl sm:text-6xl">{selectedProject.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{selectedProject.location || selectedProject.address || "Location not recorded"}</p>
          </div>
          {canManage && <Button onClick={() => { setPreview(null); setGeneratorOpen(true) }}><Sparkles /> Generate tower inventory</Button>}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl">{value}</p></CardContent></Card>)}
        </section>

        <Tabs defaultValue="inventory" className="space-y-5">
          <TabsList className="h-auto w-full justify-start overflow-x-auto bg-zinc-100 p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <Card><CardHeader><CardTitle>Project brief</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>{selectedProject.description || "Add a project description, amenities and positioning statement for the sales team."}</p><p><strong>Builder:</strong> {selectedProject.builder || "—"}</p><p><strong>Location:</strong> {selectedProject.location || "—"}</p><p><strong>RERA:</strong> {selectedProject.reraId || "—"}</p></CardContent></Card>
              <Card><CardHeader><CardTitle>Availability</CardTitle></CardHeader><CardContent className="space-y-2">{Object.entries(overview.data?.byStatus || {}).map(([status, count]) => <div key={status} className="flex items-center justify-between"><Badge variant="outline" className={statusTone[status]}>{status}</Badge><strong>{count}</strong></div>)}</CardContent></Card>
            </div>
          </TabsContent>
          <TabsContent value="inventory" className="space-y-5">
            {inventory.isPending ? <Skeleton className="h-80" /> : (inventory.data?.structures || []).map((structure) => (
              <Card key={structure.id}>
                <CardHeader className="flex-row items-center justify-between"><div><CardTitle>{structure.name}</CardTitle><CardDescription>{structure.kind} · {structure.totalLevels || "No"} levels · {structure.levels.reduce((sum, level) => sum + level.units.length, 0) + structure.unlevelledUnits.length} units</CardDescription></div><Badge variant="outline">{structure.kind}</Badge></CardHeader>
                <CardContent className="space-y-3">
                  {structure.levels.map((level) => (
                    <div key={level.id} className="grid gap-3 rounded-lg border border-black/10 p-3 md:grid-cols-[100px_1fr]">
                      <div><p className="text-xs font-bold uppercase text-muted-foreground">Floor</p><p className="font-display text-2xl">{level.levelNumber}</p><p className="text-xs text-muted-foreground">{level.units.length} units</p></div>
                      <div className="flex flex-wrap gap-2">
                        {level.units.map((unit) => <div key={unit.id} className={`min-w-28 rounded-lg border p-2 ${statusTone[unit.status] || ""}`}><p className="font-mono text-sm font-bold">#{unit.unitNumber}</p><p className="text-[10px]">{unit.unitType || "Unit"} · {unit.carpetArea || "—"} sq.ft.</p><p className="mt-1 text-[10px] font-semibold">{unit.status}</p></div>)}
                      </div>
                    </div>
                  ))}
                  {structure.unlevelledUnits.length > 0 && <div className="flex flex-wrap gap-2">{structure.unlevelledUnits.map((unit) => <Badge key={unit.id} variant="outline">#{unit.unitNumber} · {unit.status}</Badge>)}</div>}
                </CardContent>
              </Card>
            ))}
            {!inventory.isPending && !inventory.data?.structures.length && <Card><CardContent className="grid min-h-64 place-items-center p-8 text-center"><div><Grid3X3 className="mx-auto size-10 text-muted-foreground" /><CardTitle className="mt-3">No operational inventory yet</CardTitle><p className="mt-2 text-sm text-muted-foreground">Generate every flat in the tower from one template.</p>{canManage && <Button className="mt-4" onClick={() => setGeneratorOpen(true)}><Sparkles /> Generate inventory</Button>}</div></CardContent></Card>}
          </TabsContent>
          <TabsContent value="pricing"><UnitRegister structures={inventory.data?.structures || []} mode="pricing" /></TabsContent>
          <TabsContent value="media"><EmptyWorkspace icon={Images} title="Project media library" description="Project photography, videos, virtual tours and floor plans remain linked to the marketing listing during compatibility migration." /></TabsContent>
          <TabsContent value="documents"><EmptyWorkspace icon={FileText} title="Project documents" description="RERA certificates, approvals, brochures and agreement templates are organized here." /></TabsContent>
          <TabsContent value="deals"><DealRegister deals={deals.data || []} /></TabsContent>
          <TabsContent value="collections"><EmptyWorkspace icon={WalletCards} title="Collections schedule" description="Confirmed receipts are connected to each executed agreement and surfaced in management reporting." /></TabsContent>
          <TabsContent value="audit"><EmptyWorkspace icon={CheckCircle2} title="Audit trail enabled" description="Generation, reservation, agreement, collection, expense and cancellation events preserve actor and timestamp details." /></TabsContent>
        </Tabs>

        <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
          <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
            <DialogHeader><DialogTitle>Bulk inventory generator</DialogTitle><DialogDescription>Define a reusable floor template, inspect every generated unit, then commit the batch atomically.</DialogDescription></DialogHeader>
            {!preview ? (
              <div className="grid gap-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Structure name"><Input value={generator.structureName} onChange={(event) => setGenerator({ ...generator, structureName: event.target.value })} /></Field>
                <Field label="Structure type"><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={generator.kind} onChange={(event) => setGenerator({ ...generator, kind: event.target.value })}><option>Tower</option><option>Block</option><option>Phase</option><option>CommercialWing</option><option>VillaPhase</option><option>PlotLayout</option></select></Field>
                <Field label="Numbering pattern"><Input value={generator.pattern} onChange={(event) => setGenerator({ ...generator, pattern: event.target.value })} /><p className="mt-1 text-[10px] text-muted-foreground">Use {"{floor}"} and {"{sequence:02}"}.</p></Field>
                {!["PlotLayout", "VillaPhase"].includes(generator.kind) && <><Field label="First floor"><Input type="number" value={generator.floorFrom} onChange={(event) => setGenerator({ ...generator, floorFrom: event.target.value })} /></Field><Field label="Last floor"><Input type="number" value={generator.floorTo} onChange={(event) => setGenerator({ ...generator, floorTo: event.target.value })} /></Field></>}
                <Field label={["PlotLayout", "VillaPhase"].includes(generator.kind) ? "Total units" : "Units per floor"}><Input type="number" value={generator.unitsPerFloor} onChange={(event) => setGenerator({ ...generator, unitsPerFloor: event.target.value })} /></Field>
                <Field label="Excluded floors"><Input placeholder="13, 24" value={generator.excludedFloors} onChange={(event) => setGenerator({ ...generator, excludedFloors: event.target.value })} /></Field>
                <Field label="Unit type"><Input value={generator.unitType} onChange={(event) => setGenerator({ ...generator, unitType: event.target.value })} /></Field>
                <Field label="Bedrooms"><Input type="number" value={generator.bedrooms} onChange={(event) => setGenerator({ ...generator, bedrooms: event.target.value })} /></Field>
                <Field label="Carpet area (sq.ft.)"><Input type="number" value={generator.carpetArea} onChange={(event) => setGenerator({ ...generator, carpetArea: event.target.value })} /></Field>
                <Field label="Listing price"><Input type="number" value={generator.listingPrice} onChange={(event) => setGenerator({ ...generator, listingPrice: event.target.value })} /></Field>
                <Field label="Base / acquisition cost"><Input type="number" value={generator.baseCost} onChange={(event) => setGenerator({ ...generator, baseCost: event.target.value })} /></Field>
                <Field label="Facing"><Input value={generator.facing} onChange={(event) => setGenerator({ ...generator, facing: event.target.value })} /></Field>
              </div>
            ) : (
              <div className="space-y-4 py-3">
                <div className="grid gap-3 sm:grid-cols-4">{[["Floors", preview.summary.floors], ["Units", preview.summary.units], ["Conflicts", preview.summary.conflicts], ["Inventory value", money(preview.summary.estimatedInventoryValue)]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl">{value}</p></CardContent></Card>)}</div>
                {preview.warnings.map((warning) => <p key={warning} className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>)}
                <div className="max-h-96 overflow-auto rounded-lg border">
                  <Table><TableHeader><TableRow><TableHead>Floor</TableHead><TableHead>Unit</TableHead><TableHead>Type</TableHead><TableHead>Area</TableHead><TableHead>Facing</TableHead><TableHead>Price</TableHead><TableHead>Validation</TableHead></TableRow></TableHeader><TableBody>{preview.units.map((unit) => <TableRow key={`${unit.floorNumber}-${unit.unitNumber}`}><TableCell>{unit.floorNumber ?? "—"}</TableCell><TableCell className="font-mono font-bold">{unit.unitNumber}</TableCell><TableCell>{unit.unitType}</TableCell><TableCell>{unit.carpetArea || "—"}</TableCell><TableCell>{unit.facing}</TableCell><TableCell>{money(unit.listingPrice)}</TableCell><TableCell>{unit.conflict ? <Badge variant="destructive">Conflict</Badge> : <Badge className="bg-emerald-600">Ready</Badge>}</TableCell></TableRow>)}</TableBody></Table>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => preview ? setPreview(null) : setGeneratorOpen(false)}>{preview ? "Edit template" : "Cancel"}</Button>
              {!preview ? <Button onClick={() => previewGeneration.mutate()} disabled={previewGeneration.isPending}>{previewGeneration.isPending ? "Building preview…" : "Preview all units"}</Button> : <Button onClick={() => commitGeneration.mutate()} disabled={commitGeneration.isPending || preview.summary.conflicts > 0}>{commitGeneration.isPending ? "Creating inventory…" : `Create ${preview.summary.units} units`}</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Inventory portfolio</p><h1 className="mt-2 font-display text-4xl sm:text-6xl">Projects and live availability.</h1><p className="mt-3 text-sm text-muted-foreground">Operational inventory organized by project, structure, floor and unit.</p></div>
        {canManage && <Button onClick={() => setCreateOpen(true)}><Plus /> New project</Button>}
      </section>
      <div className="relative max-w-lg"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search project, builder, location or RERA…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {projects.isPending ? <div className="grid gap-4 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-60" />)}</div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => <Card key={project.id} className="cursor-pointer border-black/10 transition hover:-translate-y-0.5 hover:shadow-lg" onClick={() => setSelectedProjectId(project.id)}><CardHeader><div className="flex items-start justify-between"><div className="rounded-full bg-black p-2.5 text-white"><Building2 className="size-5" /></div><Badge variant="outline">{project.reraId || "RERA pending"}</Badge></div><CardTitle className="mt-4 font-display text-2xl">{project.name}</CardTitle><CardDescription>{project.builder || "Builder not recorded"} · {project.location || "Location pending"}</CardDescription></CardHeader><CardContent><div className="grid grid-cols-3 gap-3 border-t pt-4 text-center"><div><strong>{project.structureCount}</strong><p className="text-[10px] text-muted-foreground">Structures</p></div><div><strong>{project.unitCount}</strong><p className="text-[10px] text-muted-foreground">Units</p></div><div><strong>{project.availableUnits}</strong><p className="text-[10px] text-muted-foreground">Available</p></div></div><div className="mt-4 flex items-center justify-between text-xs"><span>Inventory value</span><strong>{money(project.inventoryValue)}</strong></div></CardContent></Card>)}
        </div>
      )}
      {!projects.isPending && !filteredProjects.length && <Card><CardContent className="grid min-h-72 place-items-center text-center"><div><Layers3 className="mx-auto size-10 text-muted-foreground" /><CardTitle className="mt-3">No projects found</CardTitle><p className="mt-2 text-sm text-muted-foreground">Create the development before generating towers and units.</p></div></CardContent></Card>}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Create project</DialogTitle><DialogDescription>Set up the development-level record. Towers, floors and units are generated next.</DialogDescription></DialogHeader><div className="grid gap-4 py-3"><Field label="Project name"><Input value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} /></Field><Field label="Onboarded builder / developer"><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={projectForm.developerId} onChange={(event) => { const developer = developers.data?.find((item) => item.id === event.target.value); setProjectForm({ ...projectForm, developerId: event.target.value, builder: developer?.name || "" }) }}><option value="">Select partner</option>{(developers.data || []).filter((developer) => developer.status === "Active").map((developer) => <option key={developer.id} value={developer.id}>{developer.name}</option>)}</select>{!developers.isPending && !developers.data?.length && <p className="mt-1 text-[10px] text-amber-700">Onboard a builder or developer from the Inventory navigation first.</p>}</Field><Field label="Location"><Input value={projectForm.location} onChange={(event) => setProjectForm({ ...projectForm, location: event.target.value })} /></Field><Field label="RERA registration"><Input value={projectForm.reraId} onChange={(event) => setProjectForm({ ...projectForm, reraId: event.target.value })} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={!projectForm.name.trim() || !projectForm.developerId || createProject.isPending} onClick={() => createProject.mutate()}>Create project</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block text-xs font-semibold">{label}</Label>{children}</div>
}

function EmptyWorkspace({ icon: Icon, title, description }: { icon: typeof Images; title: string; description: string }) {
  return <Card><CardContent className="grid min-h-64 place-items-center p-8 text-center"><div><Icon className="mx-auto size-10 text-muted-foreground" /><CardTitle className="mt-3">{title}</CardTitle><p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{description}</p></div></CardContent></Card>
}

function UnitRegister({ structures, mode }: { structures: InventoryStructure[]; mode: "pricing" }) {
  const units = structures.flatMap((structure) => [...structure.levels.flatMap((level) => level.units.map((unit) => ({ ...unit, floor: level.levelNumber, structure: structure.name }))), ...structure.unlevelledUnits.map((unit) => ({ ...unit, floor: null, structure: structure.name }))])
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Tags className="size-5" /> Unit pricing register</CardTitle><CardDescription>Listing and base cost values used by inventory and deal profitability.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Structure</TableHead><TableHead>Floor</TableHead><TableHead>Unit</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">List price</TableHead>{mode === "pricing" && <TableHead className="text-right">Base cost</TableHead>}</TableRow></TableHeader><TableBody>{units.map((unit) => <TableRow key={unit.id}><TableCell>{unit.structure}</TableCell><TableCell>{unit.floor ?? "—"}</TableCell><TableCell className="font-mono font-bold">{unit.unitNumber}</TableCell><TableCell>{unit.unitType || "—"}</TableCell><TableCell><Badge variant="outline" className={statusTone[unit.status]}>{unit.status}</Badge></TableCell><TableCell className="text-right">{money(unit.listingPrice)}</TableCell><TableCell className="text-right">{money(unit.baseCost)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
}

function DealRegister({ deals }: { deals: Array<Record<string, unknown>> }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><CircleDollarSign className="size-5" /> Project deals</CardTitle><CardDescription>Reservations, executed agreements and reversals tied to this project.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Deal</TableHead><TableHead>Status</TableHead><TableHead>Agreement</TableHead><TableHead className="text-right">Net sale</TableHead><TableHead className="text-right">Agency income</TableHead></TableRow></TableHeader><TableBody>{deals.map((deal) => <TableRow key={String(deal.id)}><TableCell className="font-mono text-xs">{String(deal.dealNumber)}</TableCell><TableCell><Badge variant="outline">{String(deal.status)}</Badge></TableCell><TableCell>{String(deal.agreementNumber || "—")}</TableCell><TableCell className="text-right">{money(Number(deal.netSaleValue))}</TableCell><TableCell className="text-right">{money(Number(deal.agencyCommission))}</TableCell></TableRow>)}{!deals.length && <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">No deals recorded for this project.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
}

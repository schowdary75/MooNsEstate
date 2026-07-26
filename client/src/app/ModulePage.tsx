import { useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useNavigate } from "react-router-dom"
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileUp,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { createRecord, deleteRecord, deleteRecords, errorMessage, importRecords, listRecords, updateRecord } from "./api"
import type { CrmRecord, FieldConfig, ModuleConfig } from "./types"
import { displayValue, formatFieldValue, recordId } from "./types"

const PAGE_SIZE = 12

const toFormValues = (module: ModuleConfig, record?: CrmRecord | null) =>
  Object.fromEntries(module.fields.filter((field) => field.key !== "createdDate").map((field) => [field.key, displayValue(record?.[field.key]).replace("—", "")]))

function RecordForm({
  module,
  record,
  open,
  onOpenChange,
}: {
  module: ModuleConfig
  record: CrmRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const shape: z.ZodRawShape = Object.fromEntries(
    module.fields
      .filter((field) => field.key !== "createdDate")
      .map((field) => {
        const required = field.required && !(record && field.key === "password")
        const fieldSchema = z.string().trim().superRefine((value, context) => {
          if (required && !value) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: `${field.label} is required` })
            return
          }
          if (!value) return
          if (field.type === "email" && !z.string().email().safeParse(value).success) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid email address" })
          }
          if (field.type === "url" && !z.string().url().safeParse(value).success) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: "Include the complete URL, such as https://example.com" })
          }
          if (field.type === "number") {
            const number = Number(value)
            if (!Number.isFinite(number)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid number" })
            if (field.min !== undefined && number < field.min) context.addIssue({ code: z.ZodIssueCode.custom, message: `Minimum value is ${field.min}` })
            if (field.max !== undefined && number > field.max) context.addIssue({ code: z.ZodIssueCode.custom, message: `Maximum value is ${field.max}` })
          }
          if (field.type === "password" && !record && value.length < 8) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: "Use at least 8 characters" })
          }
        })
        return [field.key, fieldSchema]
      }),
  )
  const schema = z.object(shape)
  type FormValues = z.infer<typeof schema>
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: toFormValues(module, record),
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = Object.fromEntries(
        Object.entries(values).map(([key, value]) => {
          const field = module.fields.find((item) => item.key === key)
          if (field?.type === "number" && value !== "") return [key, Number(value)]
          if (field?.options?.includes("true")) return [key, value === "true"]
          return [key, value]
        }),
      )
      const id = record ? recordId(record) : ""
      return id ? updateRecord(module.endpoint, id, payload) : createRecord(module.endpoint, payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["records", module.endpoint] })
      toast.success(`${module.singular} ${record ? "updated" : "created"}`)
      onOpenChange(false)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && form.formState.isDirty && !window.confirm("Discard your unsaved changes?")) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{record ? `Edit ${module.singular}` : `New ${module.singular}`}</DialogTitle>
          <DialogDescription>Fields marked as required must be completed before saving.</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <div className="grid gap-5 sm:grid-cols-2">
            {module.fields
              .filter((field) => field.key !== "createdDate")
              .map((field) => {
                const error = form.formState.errors[field.key]?.message
                return (
                  <div className={field.type === "textarea" ? "space-y-2 sm:col-span-2" : "space-y-2"} key={field.key}>
                    <Label htmlFor={field.key}>{field.label}{field.required ? " *" : ""}</Label>
                    {field.type === "textarea" ? (
                      <Textarea id={field.key} rows={5} {...form.register(field.key)} />
                    ) : (field.type === "select" && field.options) || field.type === "boolean" ? (
                      <Select
                        value={String(form.watch(field.key) || "")}
                        onValueChange={(value) => form.setValue(field.key, value, { shouldValidate: true })}
                      >
                        <SelectTrigger id={field.key}><SelectValue placeholder={`Select ${field.label.toLowerCase()}`} /></SelectTrigger>
                        <SelectContent>
                          {(field.options || ["true", "false"]).map((option) => (
                            <SelectItem key={option} value={option}>
                              {field.type === "boolean" ? (option === "true" ? "Yes" : "No") : option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={field.key}
                        type={
                          field.type === "email" || field.type === "number" || field.type === "date" || field.type === "url" || field.type === "password"
                            ? field.type
                            : field.type === "phone"
                              ? "tel"
                              : field.type === "datetime"
                                ? "datetime-local"
                                : "text"
                        }
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        inputMode={field.type === "currency" || field.type === "phone" ? "decimal" : undefined}
                        placeholder={field.placeholder}
                        {...form.register(field.key)}
                      />
                    )}
                    {field.description && <p className="text-xs leading-5 text-muted-foreground">{field.description}</p>}
                    {error && <p className="text-xs font-medium text-black">{String(error)}</p>}
                  </div>
                )
              })}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!form.formState.isDirty || window.confirm("Discard your unsaved changes?")) onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save record"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RecordDetails({
  module,
  record,
  open,
  onOpenChange,
}: {
  module: ModuleConfig
  record: CrmRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{module.singular} details</DialogTitle>
          <DialogDescription>Complete record information from the CRM.</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
          {module.fields.map((field) => (
            <div className="bg-white p-4" key={field.key}>
              <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{field.label}</dt>
              <dd className="mt-2 break-words text-sm font-medium">{formatFieldValue(field, record?.[field.key])}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}

const downloadCsv = (module: ModuleConfig, records: CrmRecord[]) => {
  const headers = module.fields.map((field) => field.key)
  const quote = (value: unknown) => `"${displayValue(value).replaceAll('"', '""')}"`
  const csv = [headers.join(","), ...records.map((record) => headers.map((key) => quote(record[key])).join(","))].join("\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `${module.key}-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function ModulePage({ module }: { module: ModuleConfig }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState(module.fields[0]?.key || "createdDate")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const filterField = module.fields.find((field) => field.type === "select" && field.options?.length)
  const [filterValue, setFilterValue] = useState("all")
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editing, setEditing] = useState<CrmRecord | null>(null)
  const [viewing, setViewing] = useState<CrmRecord | null>(null)
  const [deleting, setDeleting] = useState<CrmRecord | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const query = useQuery({
    queryKey: ["records", module.endpoint],
    queryFn: () => listRecords(module.endpoint),
  })

  const records = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return [...(query.data || [])]
      .filter((record) => filterValue === "all" || !filterField || String(record[filterField.key] || "") === filterValue)
      .filter((record) => !needle || module.fields.some((field) => formatFieldValue(field, record[field.key]).toLowerCase().includes(needle)))
      .sort((left, right) => {
        const sortField = module.fields.find((field) => field.key === sortKey) || module.fields[0]
        const a = formatFieldValue(sortField, left[sortKey]).toLowerCase()
        const b = formatFieldValue(sortField, right[sortKey]).toLowerCase()
        return a.localeCompare(b) * (sortDirection === "asc" ? 1 : -1)
      })
  }, [filterField, filterValue, module.fields, query.data, search, sortDirection, sortKey])

  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const remove = useMutation({
    mutationFn: (record: CrmRecord) => deleteRecord(module.endpoint, recordId(record)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["records", module.endpoint] })
      setDeleting(null)
      toast.success(`${module.singular} deleted`)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const bulkRemove = useMutation({
    mutationFn: () => deleteRecords(module.endpoint, selected),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["records", module.endpoint] })
      toast.success(`${selected.length} ${module.label.toLowerCase()} deleted`)
      setSelected([])
      setBulkDeleteOpen(false)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const handleImport = async (file?: File) => {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Record<string, unknown>[]
      if (!Array.isArray(parsed)) throw new Error("Import file must contain a JSON array")
      await importRecords(module.endpoint, parsed)
      await queryClient.invalidateQueries({ queryKey: ["records", module.endpoint] })
      toast.success(`${parsed.length} records imported`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const columns = module.fields.filter((field) => field.table !== false).slice(0, 5)
  const visibleIds = visible.map(recordId).filter(Boolean)
  const allVisibleSelected = !!visibleIds.length && visibleIds.every((id) => selected.includes(id))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{module.group}</p>
          <h2 className="mt-1 font-display text-4xl tracking-tight sm:text-5xl">{module.label}</h2>
          <p className="mt-2 text-sm text-muted-foreground">Search, review, and manage {module.label.toLowerCase()} from one focused view.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={query.isFetching ? "animate-spin" : ""} /> Refresh
          </Button>
          <Button variant="outline" onClick={() => downloadCsv(module, records)} disabled={!records.length}>
            <Download /> Export
          </Button>
          {module.addMany && (
            <>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => handleImport(event.target.files?.[0])} />
              <Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp /> Import JSON</Button>
            </>
          )}
          {!module.readOnly && (
            <Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus /> Add {module.singular}</Button>
          )}
        </div>
      </div>

      <Card className="editorial-shadow overflow-hidden border-black/10 bg-white">
        <CardHeader className="border-b border-black/10 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="text-base">{records.length} records</CardTitle>
                {!!selected.length && !module.readOnly && (
                  <>
                    <Badge className="rounded-full bg-black text-white">{selected.length} selected</Badge>
                    <Button size="sm" variant="outline" onClick={() => setBulkDeleteOpen(true)}>
                      <Trash2 /> Delete selected
                    </Button>
                  </>
                )}
              </div>
              <CardDescription className="mt-1">Live data from the {module.label} service</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(1) }}
                  placeholder={`Search ${module.label.toLowerCase()}…`}
                  className="pl-9"
                />
              </div>
              {filterField && (
                <Select
                  value={filterValue}
                  onValueChange={(value) => {
                    setFilterValue(value)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-44" aria-label={`Filter by ${filterField.label}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All {filterField.label.toLowerCase()}</SelectItem>
                    {filterField.options?.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Select value={sortKey} onValueChange={setSortKey}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {module.fields.map((field) => <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortDirection((value) => value === "asc" ? "desc" : "asc")}
                aria-label={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}
              >
                {sortDirection === "asc" ? <ArrowDownAZ /> : <ArrowUpAZ />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isPending ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 6 }).map((_, index) => <Skeleton className="h-12 w-full" key={index} />)}
            </div>
          ) : query.isError ? (
            <div className="grid min-h-72 place-items-center p-8 text-center">
              <div>
                <p className="font-display text-2xl">Unable to load {module.label.toLowerCase()}.</p>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">{errorMessage(query.error)}</p>
                <Button className="mt-5" variant="outline" onClick={() => query.refetch()}>Try again</Button>
              </div>
            </div>
          ) : !visible.length ? (
            <div className="grid min-h-72 place-items-center p-8 text-center">
              <div>
                <div className="mx-auto grid size-12 place-items-center rounded-full border border-black/15 bg-muted">
                  <module.icon className="size-5" />
                </div>
                <p className="mt-4 font-display text-2xl">{search ? "No matching records." : `No ${module.label.toLowerCase()} yet.`}</p>
                <p className="mt-2 text-sm text-muted-foreground">{search ? "Try a broader search term." : "Add the first record to begin."}</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    {!module.readOnly && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allVisibleSelected}
                          aria-label={`Select all visible ${module.label.toLowerCase()}`}
                          onCheckedChange={(checked) => {
                            setSelected((current) => checked
                              ? [...new Set([...current, ...visibleIds])]
                              : current.filter((id) => !visibleIds.includes(id)))
                          }}
                        />
                      </TableHead>
                    )}
                    {columns.map((field) => <TableHead key={field.key}>{field.label}</TableHead>)}
                    <TableHead className="w-16 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((record) => (
                    <TableRow
                      key={recordId(record) || JSON.stringify(record)}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => { setViewing(record); setDetailsOpen(true) }}
                    >
                      {!module.readOnly && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.includes(recordId(record))}
                            aria-label={`Select ${formatFieldValue(columns[0], record[columns[0]?.key])}`}
                            onCheckedChange={(checked) => {
                              const id = recordId(record)
                              setSelected((current) => checked
                                ? [...new Set([...current, id])]
                                : current.filter((item) => item !== id))
                            }}
                          />
                        </TableCell>
                      )}
                      {columns.map((field, columnIndex) => (
                        <TableCell className={columnIndex === 0 ? "font-semibold" : "max-w-64 truncate text-muted-foreground"} key={field.key}>
                          {field.key.toLowerCase().includes("status") ? (
                            <Badge variant="outline" className="rounded-full border-black/20 font-medium">{formatFieldValue(field, record[field.key])}</Badge>
                          ) : formatFieldValue(field, record[field.key])}
                        </TableCell>
                      ))}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label={`Actions for ${module.singular}`}><MoreHorizontal /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {module.key === "leads" && (
                              <>
                                <DropdownMenuItem onSelect={() => navigate("/followups")}>
                                  <CalendarDays className="mr-2 size-4 text-blue-600" /> Schedule Follow-Up
                                </DropdownMenuItem>
                                {Boolean(record.leadPhoneNumber) && (
                                  <DropdownMenuItem
                                    onSelect={() => navigate(`/leads?leadId=${recordId(record)}&channel=whatsapp`)}
                                  >
                                    <MessageSquare className="mr-2 size-4 text-emerald-600" /> WhatsApp Lead
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            {!module.readOnly && (
                              <DropdownMenuItem onSelect={() => { setEditing(record); setFormOpen(true) }}><Pencil /> Edit</DropdownMenuItem>
                            )}
                            {!module.readOnly && <DropdownMenuSeparator />}
                            {!module.readOnly && (
                              <DropdownMenuItem onSelect={() => setDeleting(record)}><Trash2 /> Delete</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-black/10 px-4 py-3">
            <p className="text-xs text-muted-foreground">Page {currentPage} of {pageCount}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft /></Button>
              <Button variant="outline" size="icon" disabled={currentPage >= pageCount} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <RecordForm module={module} record={editing} open={formOpen} onOpenChange={setFormOpen} />
      <RecordDetails module={module} record={viewing} open={detailsOpen} onOpenChange={setDetailsOpen} />
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {module.singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>This action removes the record from active views. It cannot be undone from this screen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting)} disabled={remove.isPending}>
              {remove.isPending ? "Deleting…" : "Delete record"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.length} selected records?</AlertDialogTitle>
            <AlertDialogDescription>
              The selected records will be removed from active views. This action cannot be undone from this screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => bulkRemove.mutate()} disabled={bulkRemove.isPending}>
              {bulkRemove.isPending ? "Deleting…" : "Delete selected"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

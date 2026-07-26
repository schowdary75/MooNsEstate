import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { ArrowUpRight, CalendarDays, GripVertical, Search, Target } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { errorMessage, listRecords, updateRecord } from "./api"
import type { CrmRecord } from "./types"
import { displayValue, numericValue, recordId } from "./types"

export const pipelineStages = ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]

const money = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numericValue(value))

function PipelineCard({
  record,
  onStageChange,
  pending,
}: {
  record: CrmRecord
  onStageChange: (record: CrmRecord, stage: string) => void
  pending: boolean
}) {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const id = recordId(record)

  useEffect(() => {
    if (!element || !id) return
    return draggable({
      element,
      getInitialData: () => ({ kind: "opportunity", recordId: id }),
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    })
  }, [element, id])

  return (
    <article
      ref={setElement}
      className={`rounded-xl border border-black/10 bg-white p-4 shadow-sm transition-all ${
        dragging ? "scale-[0.98] opacity-45" : "hover:-translate-y-0.5 hover:shadow-md"
      }`}
      data-testid={`pipeline-card-${id}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden="true">
          <GripVertical className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold leading-5">{displayValue(record.opportunityName)}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{displayValue(record.accountName)}</p>
            </div>
            <Button asChild size="icon" variant="ghost" className="-mr-2 -mt-2 size-8">
              <Link to="/opportunities" aria-label="Open opportunities"><ArrowUpRight /></Link>
            </Button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="font-display text-xl">{money(record.amount)}</p>
            <Badge variant="outline" className="rounded-full border-black/15">
              {displayValue(record.probability).replace("%", "")}%
            </Badge>
          </div>
          {record.closeDate && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" /> {displayValue(record.closeDate)}
            </p>
          )}
          <label className="mt-4 block">
            <span className="sr-only">Move {displayValue(record.opportunityName)} to stage</span>
            <select
              className="h-9 w-full rounded-md border border-black/15 bg-white px-2 text-xs font-semibold"
              value={String(record.stage || "Prospecting")}
              disabled={pending}
              onChange={(event) => onStageChange(record, event.target.value)}
            >
              {pipelineStages.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
          </label>
        </div>
      </div>
    </article>
  )
}

function PipelineColumn({
  stage,
  records,
  onStageChange,
  pending,
}: {
  stage: string
  records: CrmRecord[]
  onStageChange: (record: CrmRecord, stage: string) => void
  pending: boolean
}) {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [over, setOver] = useState(false)

  useEffect(() => {
    if (!element) return
    return dropTargetForElements({
      element,
      getData: () => ({ kind: "pipeline-stage", stage }),
      canDrop: ({ source }) => source.data.kind === "opportunity",
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: () => setOver(false),
    })
  }, [element, stage])

  const total = records.reduce((sum, record) => sum + numericValue(record.amount), 0)

  return (
    <section
      ref={setElement}
      className={`flex w-[310px] shrink-0 flex-col rounded-2xl border p-3 transition-colors ${
        over ? "border-black bg-black/[0.07]" : "border-black/10 bg-black/[0.025]"
      }`}
      data-testid={`pipeline-column-${stage}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3 px-1 py-1">
        <div>
          <h3 className="text-sm font-bold">{stage}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{money(total)} pipeline</p>
        </div>
        <Badge className="rounded-full bg-black text-white">{records.length}</Badge>
      </div>
      <div className="min-h-32 space-y-3">
        {records.map((record) => (
          <PipelineCard
            key={recordId(record)}
            record={record}
            pending={pending}
            onStageChange={onStageChange}
          />
        ))}
        {!records.length && (
          <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-black/15 bg-white/50 p-4 text-center">
            <p className="text-xs text-muted-foreground">Drop an opportunity here</p>
          </div>
        )}
      </div>
    </section>
  )
}

export function PipelinePage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const query = useQuery({
    queryKey: ["records", "opportunity"],
    queryFn: () => listRecords("opportunity"),
  })

  const move = useMutation({
    mutationFn: ({ record, stage }: { record: CrmRecord; stage: string }) =>
      updateRecord("opportunity", recordId(record), { stage }),
    onMutate: async ({ record, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["records", "opportunity"] })
      const previous = queryClient.getQueryData<CrmRecord[]>(["records", "opportunity"])
      queryClient.setQueryData<CrmRecord[]>(["records", "opportunity"], (records = []) =>
        records.map((item) => recordId(item) === recordId(record) ? { ...item, stage } : item),
      )
      return { previous }
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(["records", "opportunity"], context?.previous)
      toast.error(errorMessage(error))
    },
    onSuccess: () => toast.success("Pipeline stage updated"),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["records", "opportunity"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      ])
    },
  })

  useEffect(() => monitorForElements({
    canMonitor: ({ source }) => source.data.kind === "opportunity",
    onDrop: ({ source, location }) => {
      const target = location.current.dropTargets.find((item) => item.data.kind === "pipeline-stage")
      const record = query.data?.find((item) => recordId(item) === String(source.data.recordId || ""))
      const stage = target?.data.stage
      if (record && typeof stage === "string" && stage !== record.stage) move.mutate({ record, stage })
    },
  }), [query.data, move])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return query.data || []
    return (query.data || []).filter((record) =>
      [record.opportunityName, record.accountName, record.stage, record.assignUser]
        .some((value) => String(value || "").toLowerCase().includes(needle)),
    )
  }, [query.data, search])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 border-b border-black/15 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Revenue workspace</p>
          <h2 className="mt-1 font-display text-4xl tracking-tight sm:text-5xl">Deal pipeline</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Drag opportunities between stages or use the stage selector for an accessible keyboard workflow.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search deals, accounts, owners…" className="pl-9" />
          </div>
          <Button asChild><Link to="/opportunities"><Target /> Manage opportunities</Link></Button>
        </div>
      </div>

      {query.isPending ? (
        <div className="flex gap-4 overflow-hidden">
          {pipelineStages.slice(0, 4).map((stage) => <Skeleton key={stage} className="h-[520px] w-[310px] shrink-0 rounded-2xl" />)}
        </div>
      ) : query.isError ? (
        <Card><CardContent className="grid min-h-64 place-items-center p-8 text-center">
          <div><CardTitle>Unable to load the pipeline.</CardTitle><Button className="mt-4" variant="outline" onClick={() => query.refetch()}>Retry</Button></div>
        </CardContent></Card>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex min-w-max gap-4">
            {pipelineStages.map((stage) => (
              <PipelineColumn
                key={stage}
                stage={stage}
                pending={move.isPending}
                records={filtered.filter((record) => {
                  const current = String(record.stage || "Prospecting")
                  if (stage === "Closed Won") return ["Closed Won", "Won", "Closed"].includes(current)
                  return current === stage
                })}
                onStageChange={(record, nextStage) => move.mutate({ record, stage: nextStage })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

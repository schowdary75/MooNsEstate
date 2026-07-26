import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { listRecords } from "./api"
import type { CrmRecord } from "./types"
import { displayValue, recordId } from "./types"

const eventDate = (record: CrmRecord) => {
  const value = record.start || record.dateTime || record.startDate
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

const eventPath = (record: CrmRecord) => {
  if (record.eventType === "Meeting") return "/meetings"
  if (record.eventType === "Call") return "/calls"
  return "/tasks"
}

export function CalendarPage() {
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const query = useQuery({
    queryKey: ["records", "calendar"],
    queryFn: () => listRecords("calendar"),
  })
  const days = useMemo(
    () => eachDayOfInterval({
      start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    }),
    [month],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-black/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Activity planning</p>
          <h2 className="mt-1 font-display text-4xl tracking-tight sm:text-5xl">Calendar</h2>
          <p className="mt-2 text-sm text-muted-foreground">Tasks, meetings, and calls organized in one monthly schedule.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => query.refetch()}><RefreshCw /> Refresh</Button>
          <Button variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth((value) => subMonths(value, 1))}><ChevronLeft /></Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth((value) => addMonths(value, 1))}><ChevronRight /></Button>
        </div>
      </div>

      <Card className="overflow-hidden border-black/10 bg-white">
        <CardHeader className="border-b border-black/10">
          <CardTitle className="font-display text-2xl">{format(month, "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {query.isPending ? <Skeleton className="m-6 h-[620px]" /> : (
            <div className="overflow-x-auto">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-7 border-b border-black/10 bg-muted/60">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div key={day} className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {days.map((day) => {
                    const events = (query.data || []).filter((record) => {
                      const date = eventDate(record)
                      return date ? isSameDay(date, day) : false
                    })
                    const today = isSameDay(day, new Date())
                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-32 border-b border-r border-black/10 p-2 ${isSameMonth(day, month) ? "bg-white" : "bg-muted/30"}`}
                      >
                        <div className={`mb-2 grid size-7 place-items-center rounded-full text-xs font-semibold ${today ? "bg-black text-white" : !isSameMonth(day, month) ? "text-muted-foreground" : ""}`}>
                          {format(day, "d")}
                        </div>
                        <div className="space-y-1.5">
                          {events.slice(0, 3).map((record) => (
                            <Link
                              key={`${record.eventType}-${recordId(record)}`}
                              to={eventPath(record)}
                              className="block rounded-md border border-black/10 bg-muted/60 px-2 py-1.5 text-[11px] transition-colors hover:bg-black hover:text-white"
                            >
                              <span className="block truncate font-semibold">{displayValue(record.title || record.agenda)}</span>
                              <span className="mt-0.5 block truncate opacity-65">{displayValue(record.eventType || record.category)}</span>
                            </Link>
                          ))}
                          {events.length > 3 && <Badge variant="outline" className="rounded-full">+{events.length - 3} more</Badge>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

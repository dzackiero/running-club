import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { AppLoading } from "@/components/AppLoading";
import { EditRunDialog } from "@/components/EditRunDialog";
import { GymWorkoutDialog } from "@/components/GymWorkoutDialog";
import { TodayAgenda } from "@/components/TodayAgenda";
import { WeeklyOverview } from "@/components/WeeklyOverview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ActivityIcon } from "@/lib/activity";
import { activityLabel } from "@/lib/activity-data";
import { deleteRun, getTodayDashboard, listRuns, type PlanOccurrenceRecord, type RunRecord, type TodayDashboard } from "@/lib/api";
import { formatDateParts, formatDurationClock, formatKm, formatPace, formatWeekRange, formatWeekYear } from "@/lib/format";
import { createLatestRequestGuard } from "@/lib/latest-request";
import { addDays, dateAtNoon, endOfDate, startOfDate, todayDateKey } from "@/lib/dashboard-date";

function RunRow({ run, onEdit, onDeleted }: { run: RunRecord; onEdit: (run: RunRecord) => void; onDeleted: () => void }) {
  const { date, weekday } = formatDateParts(run.startedAt);
  const [deleting, setDeleting] = useState(false);
  async function handleDelete() {
    if (!window.confirm("Delete this run? This can’t be undone.")) return;
    setDeleting(true);
    try { await deleteRun(run.id); toast.success("Run deleted"); onDeleted(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to delete run"); }
    finally { setDeleting(false); }
  }
  return <li className="border-b border-border text-sm last:border-b-0"><div className="relative px-2.5 transition-colors hover:bg-foreground/4"><Link to={`/runs/${run.id}`} className="flex min-w-0 gap-2.5 py-3 pr-10 outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`View ${activityLabel(run.activityType)} on ${date}`}><span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary"><ActivityIcon type={run.activityType} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-medium">{activityLabel(run.activityType)}</p><p className="truncate text-xs text-muted-foreground">{weekday} · {date}{run.notes ? ` · ${run.notes}` : ""}</p></div><p className="shrink-0 font-medium tabular-nums">{formatKm(run.distanceMeters)} <span className="font-normal text-muted-foreground">km</span></p></div><p className="mt-1 flex gap-3 text-xs tabular-nums text-muted-foreground"><span className="font-(family-name:--font-stat) text-sm font-bold text-foreground">{formatPace(run.avgPaceSecPerKm)}</span><span>{formatDurationClock(run.durationSeconds)}</span></p></div></Link><div className="absolute top-3 right-2.5" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:bg-transparent hover:text-foreground" aria-label="Run actions" disabled={deleting}><MoreVertical /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link to={`/runs/${run.id}`}>View details</Link></DropdownMenuItem><DropdownMenuItem onClick={() => onEdit(run)}>Edit</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={handleDelete}>Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div></li>;
}

function WeekNavigator({ date, week, onSelectDay }: { date: string; week: TodayDashboard["week"]; onSelectDay: (date: string) => void }) {
  const start = new Date(startOfDate(week.start));
  const end = new Date(endOfDate(week.end));
  const isThisWeek = todayDateKey() >= week.start && todayDateKey() <= week.end;
  return <section className="space-y-4" aria-label="Week navigation"><div className="flex items-center justify-between gap-2"><Button type="button" variant="ghost" size="icon-sm" onClick={() => onSelectDay(addDays(date, -7))} aria-label="Previous week"><ChevronLeft /></Button><div className="min-w-0 text-center"><p className="text-xs font-semibold tracking-wide text-primary tabular-nums">{formatWeekYear(start, end)}</p><p className="mt-1 text-lg font-semibold tracking-tight">{isThisWeek ? "This week" : formatWeekRange(start, end)}</p>{isThisWeek ? <p className="text-sm text-muted-foreground tabular-nums">{formatWeekRange(start, end)}</p> : null}</div><Button type="button" variant="ghost" size="icon-sm" onClick={() => onSelectDay(addDays(date, 7))} aria-label="Next week"><ChevronRight /></Button></div><div className="flex items-end justify-between gap-3"><p className="font-(family-name:--font-stat) text-5xl font-bold tracking-tight tabular-nums">{week.running.completedSessions}<span className="ml-1 text-2xl font-semibold text-muted-foreground">runs</span></p><p className="pb-1 text-sm text-muted-foreground tabular-nums">{week.running.completedSessions} / {week.running.plannedSessions} planned</p></div></section>;
}

export function Home() {
  const [dashboard, setDashboard] = useState<TodayDashboard | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRun, setEditingRun] = useState<RunRecord | null>(null);
  const [gymOccurrence, setGymOccurrence] = useState<PlanOccurrenceRecord | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayDateKey);
  const refreshGuard = useRef(createLatestRequestGuard());
  const refresh = useCallback(async () => {
    const requestId = refreshGuard.current.begin();
    if (refreshGuard.current.isLatest(requestId)) setLoading(true);
    const [todayResult] = await Promise.allSettled([getTodayDashboard(dateAtNoon(selectedDate))]);
    if (!refreshGuard.current.isLatest(requestId)) return;
    if (todayResult.status === "rejected") {
      setError(todayResult.reason instanceof Error ? todayResult.reason.message : "Failed to load dashboard");
      setLoading(false);
      return;
    }
    setDashboard(todayResult.value); setError(null);
    const runsResult = await Promise.allSettled([listRuns({ limit: 50, from: startOfDate(todayResult.value.week.start), to: endOfDate(todayResult.value.week.end) })]);
    if (!refreshGuard.current.isLatest(requestId)) return;
    if (runsResult[0].status === "fulfilled") setRuns(runsResult[0].value);
    else toast.error(runsResult[0].reason instanceof Error ? runsResult[0].reason.message : "Failed to load weekly activity");
    setLoading(false);
  }, [selectedDate]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (loading && !dashboard) return <AppLoading />;
  return <section className="space-y-8">
    {error && !dashboard ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    {dashboard ? <><WeekNavigator date={dashboard.date} week={dashboard.week} onSelectDay={setSelectedDate} /><TodayAgenda date={dashboard.date} items={dashboard.items} nutrition={dashboard.week.nutrition} onChanged={() => void refresh()} onLogGym={setGymOccurrence} /><WeeklyOverview week={dashboard.week} today={dashboard.date} onSelectDay={setSelectedDate} /></> : null}
    <section aria-labelledby="weekly-runs"><div className="mb-2 flex items-center justify-between gap-2"><div><p className="text-xs font-semibold tracking-wide text-primary uppercase">Activity</p><h2 id="weekly-runs" className="text-xl font-semibold tracking-tight">Runs this week</h2></div><Link to="/activity" className="text-sm text-primary underline-offset-4 hover:underline">All activity</Link></div><Separator className="mb-1" />{runs.length === 0 ? <p className="pt-4 text-sm text-muted-foreground">No runs in this week yet. Connect Intervals or log one from chat.</p> : <ul className="overflow-hidden rounded-lg border border-border">{runs.map((run) => <RunRow key={run.id} run={run} onEdit={setEditingRun} onDeleted={() => void refresh()} />)}</ul>}</section>
    {editingRun ? <EditRunDialog open onOpenChange={(open) => { if (!open) setEditingRun(null); }} run={editingRun} onSaved={() => void refresh()} /> : null}
    <GymWorkoutDialog occurrence={gymOccurrence} open={gymOccurrence !== null} onOpenChange={(open) => { if (!open) setGymOccurrence(null); }} onSaved={() => void refresh()} />
  </section>;
}

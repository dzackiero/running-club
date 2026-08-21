import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MoreVertical } from "lucide-react";
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
import { ActivityIcon, activityLabel } from "@/lib/activity";
import { deleteRun, getTodayDashboard, listRuns, type PlanOccurrenceRecord, type RunRecord, type TodayDashboard } from "@/lib/api";
import { formatDateParts, formatDurationClock, formatKm, formatPace } from "@/lib/format";
import { createLatestRequestGuard } from "@/lib/latest-request";

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

export function Home() {
  const [dashboard, setDashboard] = useState<TodayDashboard | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRun, setEditingRun] = useState<RunRecord | null>(null);
  const [gymOccurrence, setGymOccurrence] = useState<PlanOccurrenceRecord | null>(null);
  const refreshGuard = useRef(createLatestRequestGuard());
  const refresh = useCallback(async () => {
    const requestId = refreshGuard.current.begin();
    if (refreshGuard.current.isLatest(requestId)) setLoading(true);
    const [todayResult, runsResult] = await Promise.allSettled([getTodayDashboard(), listRuns({ limit: 10 })]);
    if (!refreshGuard.current.isLatest(requestId)) return;
    if (todayResult.status === "fulfilled") { setDashboard(todayResult.value); setError(null); }
    else setError(todayResult.reason instanceof Error ? todayResult.reason.message : "Failed to load today");
    if (runsResult.status === "fulfilled") setRuns(runsResult.value);
    else toast.error(runsResult.reason instanceof Error ? runsResult.reason.message : "Failed to load recent runs");
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  if (loading && !dashboard) return <AppLoading />;
  return <section className="space-y-8">
    {error && !dashboard ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    {dashboard ? <><TodayAgenda items={dashboard.items} onChanged={() => void refresh()} onLogGym={setGymOccurrence} /><WeeklyOverview week={dashboard.week} today={dashboard.date} /></> : null}
    <section aria-labelledby="recent-runs"><div className="mb-2 flex items-center justify-between gap-2"><div><p className="text-xs font-semibold tracking-wide text-primary uppercase">Recent activity</p><h2 id="recent-runs" className="text-xl font-semibold tracking-tight">Recent runs</h2></div><Link to="/connect" className="text-sm text-primary underline-offset-4 hover:underline">Sync</Link></div><Separator className="mb-1" />{runs.length === 0 ? <p className="pt-4 text-sm text-muted-foreground">No runs logged yet. Connect Intervals or log one from chat.</p> : <ul className="overflow-hidden rounded-lg border border-border">{runs.map((run) => <RunRow key={run.id} run={run} onEdit={setEditingRun} onDeleted={() => void refresh()} />)}</ul>}</section>
    {editingRun ? <EditRunDialog open onOpenChange={(open) => { if (!open) setEditingRun(null); }} run={editingRun} onSaved={() => void refresh()} /> : null}
    <GymWorkoutDialog occurrence={gymOccurrence} open={gymOccurrence !== null} onOpenChange={(open) => { if (!open) setGymOccurrence(null); }} onSaved={() => void refresh()} />
  </section>;
}

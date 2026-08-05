import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { weeklyGoalHasTargets } from "@running-club/shared";
import { LogRunDialog } from "@/components/LogRunDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ActivityIcon, activityLabel } from "@/lib/activity";
import {
  deleteRun,
  getWeekProgress,
  listRuns,
  type RunRecord,
  type WeekProgress,
} from "@/lib/api";
import {
  formatDateParts,
  formatDuration,
  formatDurationClock,
  formatKm,
  formatPace,
  formatProgress,
  formatWeekRange,
  formatWeekYear,
  weekBoundsForOffset,
} from "@/lib/format";
import { cn } from "@/lib/utils";

function ProgressBar({ ratio }: { ratio: number | null }) {
  const pct = Math.max(0, Math.min(100, Math.round((ratio ?? 0) * 100)));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-secondary"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function weekTitle(weekOffset: number): string | null {
  if (weekOffset === 0) return "This week";
  if (weekOffset === -1) return "Last week";
  return null;
}

function WeekSnapshot({
  progress,
  weekOffset,
  weekStart,
  weekEnd,
  loading,
  onPrevWeek,
  onNextWeek,
}: {
  progress: WeekProgress | null;
  weekOffset: number;
  weekStart: Date;
  weekEnd: Date;
  loading: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}) {
  const totals = progress?.totals ?? {
    distanceMeters: 0,
    durationSeconds: 0,
    runCount: 0,
  };
  const goal = progress?.goal ?? null;
  const ratios = progress?.progress ?? {
    distanceRatio: null,
    durationRatio: null,
    runCountRatio: null,
  };
  const hasGoal = weeklyGoalHasTargets(goal);
  const year = formatWeekYear(weekStart, weekEnd);
  const range = formatWeekRange(weekStart, weekEnd);
  const title = weekTitle(weekOffset);

  const hasDistance = goal?.targetDistanceMeters != null;
  const hasDuration = goal?.targetDurationSeconds != null;
  const hasCount = goal?.targetRunCount != null;

  const primaryRatio = hasGoal
    ? ((hasDistance ? ratios.distanceRatio : null) ??
      (hasDuration ? ratios.durationRatio : null) ??
      ratios.runCountRatio)
    : null;

  const sideLines: Array<{ key: string; text: ReactNode }> = [];

  if (hasGoal && hasDistance) {
    sideLines.push({
      key: "distance",
      text: (
        <>
          of {formatKm(goal!.targetDistanceMeters!)} km ·{" "}
          {formatProgress(ratios.distanceRatio)}
        </>
      ),
    });
  }
  if (hasGoal && hasDuration) {
    sideLines.push({
      key: "duration",
      text: (
        <>
          {formatDuration(totals.durationSeconds)} /{" "}
          {formatDuration(goal!.targetDurationSeconds!)} ·{" "}
          {formatProgress(ratios.durationRatio)}
        </>
      ),
    });
  }
  if (hasGoal && hasCount) {
    sideLines.push({
      key: "count",
      text: (
        <>
          {totals.runCount} / {goal!.targetRunCount} runs ·{" "}
          {formatProgress(ratios.runCountRatio)}
        </>
      ),
    });
  }

  if (!hasGoal) {
    sideLines.push({
      key: "duration",
      text: formatDuration(totals.durationSeconds),
    });
    sideLines.push({
      key: "count",
      text: (
        <>
          {totals.runCount} {totals.runCount === 1 ? "run" : "runs"}
        </>
      ),
    });
  }

  let heroValue: ReactNode;
  let heroUnit: string | null = null;

  if (!hasGoal || hasDistance) {
    heroValue = formatKm(totals.distanceMeters);
    heroUnit = "km";
  } else if (hasDuration) {
    heroValue = formatDuration(totals.durationSeconds);
  } else {
    heroValue = totals.runCount;
    heroUnit = "runs";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onPrevWeek}
          aria-label="Previous week"
        >
          <ChevronLeft />
        </Button>
        <div className="min-w-0 text-center">
          <p className="text-xs font-semibold tracking-wide text-primary tabular-nums">
            {year}
          </p>
          {title ? (
            <p className="text-sm font-medium text-foreground">{title}</p>
          ) : null}
          <p
            className={cn(
              "tabular-nums text-muted-foreground",
              title ? "text-xs" : "text-sm font-medium text-foreground",
            )}
          >
            {range}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onNextWeek}
          disabled={weekOffset >= 0}
          aria-label="Next week"
        >
          <ChevronRight />
        </Button>
      </div>

      <div
        className={cn(
          "space-y-3 transition-opacity duration-150",
          loading ? "opacity-50" : "opacity-100",
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="stat-hero mt-1 text-foreground">
              {heroValue}
              {heroUnit ? (
                <span className="ml-1 text-2xl font-semibold text-muted-foreground">
                  {heroUnit}
                </span>
              ) : null}
            </p>
          </div>
          {sideLines.length > 0 ? (
            <div className="text-right text-sm text-muted-foreground tabular-nums">
              {sideLines.map((line) => (
                <p key={line.key}>{line.text}</p>
              ))}
            </div>
          ) : null}
        </div>
        {hasGoal ? (
          <ProgressBar ratio={primaryRatio} />
        ) : weekOffset === 0 ? (
          <p className="text-sm text-muted-foreground">
            No weekly goal set.{" "}
            <Link
              to="/goal"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Set a goal
            </Link>{" "}
            to track progress.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function RunRow({
  run,
  onEdit,
  onDeleted,
}: {
  run: RunRecord;
  onEdit: (run: RunRecord) => void;
  onDeleted: () => void;
}) {
  const { date, weekday } = formatDateParts(run.startedAt);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this run? This can’t be undone.")) return;
    setDeleting(true);
    try {
      await deleteRun(run.id);
      toast.success("Run deleted");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete run");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="border-b border-border py-3.5 text-sm">
      <div className="flex items-start gap-1">
        <Link
          to={`/runs/${run.id}`}
          className="min-w-0 flex-1 rounded-md outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`View ${activityLabel(run.activityType)} on ${date}`}
        >
          {/* Mobile / tablet: stacked row */}
          <div className="flex gap-2.5 p-1 md:hidden">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
              <ActivityIcon type={run.activityType} />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate font-medium text-foreground">
                  {activityLabel(run.activityType)}
                </p>
                <p className="shrink-0 font-medium tabular-nums text-foreground">
                  {formatKm(run.distanceMeters)}{" "}
                  <span className="font-normal text-muted-foreground">km</span>
                </p>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {weekday} · {date}
                {run.notes ? ` · ${run.notes}` : null}
              </p>
              <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
                <span className="font-[family-name:var(--font-stat)] text-sm font-bold text-foreground">
                  {formatPace(run.avgPaceSecPerKm)}
                </span>
                <span>{formatDurationClock(run.durationSeconds)}</span>
              </p>
            </div>
          </div>

          {/* Desktop: columns */}
          <div
            className={cn(
              "hidden items-center gap-3 p-1 md:grid",
              "md:grid-cols-[5.5rem_minmax(0,1fr)_4.25rem_5rem_4rem]",
            )}
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground tabular-nums">{date}</p>
              <p className="text-xs text-muted-foreground">{weekday}</p>
            </div>

            <div className="flex min-w-0 items-start gap-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
                <ActivityIcon type={run.activityType} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {activityLabel(run.activityType)}
                </p>
                {run.notes ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {run.notes}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground capitalize">
                    {run.source}
                  </p>
                )}
              </div>
            </div>

            <p className="font-medium tabular-nums">
              {formatKm(run.distanceMeters)}{" "}
              <span className="font-normal text-muted-foreground">km</span>
            </p>

            <p className="font-[family-name:var(--font-stat)] text-base font-bold tracking-tight tabular-nums">
              {formatPace(run.avgPaceSecPerKm)}
            </p>

            <p className="tabular-nums text-muted-foreground">
              {formatDurationClock(run.durationSeconds)}
            </p>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mt-1 shrink-0 text-muted-foreground"
              aria-label="Run actions"
              disabled={deleting}
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/runs/${run.id}`}>View details</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(run)}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

export function Home() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekStartsOn, setWeekStartsOn] = useState(1);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [week, setWeek] = useState<WeekProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [editingRun, setEditingRun] = useState<RunRecord | null>(null);
  const requestId = useRef(0);

  const bounds = useMemo(
    () => weekBoundsForOffset(weekOffset, weekStartsOn),
    [weekOffset, weekStartsOn],
  );

  const refresh = useCallback(() => {
    const id = ++requestId.current;
    const { weekStart, weekEnd } = weekBoundsForOffset(weekOffset, weekStartsOn);
    const from = weekStart.toISOString();
    const to = weekEnd.toISOString();

    return Promise.all([
      getWeekProgress(from),
      listRuns({ limit: 50, from, to }),
    ])
      .then(([weekProgress, runList]) => {
        if (id !== requestId.current) return;
        setWeek(weekProgress);
        setWeekStartsOn(weekProgress.goal?.weekStartsOn ?? 1);
        setRuns(runList);
        setError(null);
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      });
  }, [weekOffset, weekStartsOn]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  if (loading && !week) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error && !week) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Training</h1>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditingRun(null);
              setLogOpen(true);
            }}
          >
            Log run
          </Button>
        </div>
        <WeekSnapshot
          progress={week}
          weekOffset={weekOffset}
          weekStart={bounds.weekStart}
          weekEnd={bounds.weekEnd}
          loading={loading}
          onPrevWeek={() => setWeekOffset((o) => o - 1)}
          onNextWeek={() => setWeekOffset((o) => Math.min(0, o + 1))}
        />
      </div>

      <div
        className={cn(
          "transition-opacity duration-150",
          loading ? "opacity-50" : "opacity-100",
        )}
      >
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-primary uppercase">
            {weekOffset === 0 ? "This week’s runs" : "Runs"}
          </h2>
          <Link
            to="/goal"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Edit goal
          </Link>
        </div>
        <Separator className="mb-1" />
        {runs.length === 0 ? (
          <p className="pt-4 text-sm text-muted-foreground">
            {weekOffset === 0 ? (
              <>
                No runs yet.{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    setEditingRun(null);
                    setLogOpen(true);
                  }}
                >
                  Log your first run
                </button>{" "}
                to get started.
              </>
            ) : (
              "No runs this week."
            )}
          </p>
        ) : (
          <ul className="list-none p-0">
            {runs.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                onEdit={(r) => {
                  setEditingRun(r);
                  setLogOpen(true);
                }}
                onDeleted={() => {
                  void refresh();
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <LogRunDialog
        open={logOpen}
        onOpenChange={(open) => {
          setLogOpen(open);
          if (!open) setEditingRun(null);
        }}
        run={editingRun}
        onSaved={() => {
          void refresh();
        }}
      />
    </section>
  );
}

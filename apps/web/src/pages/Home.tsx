import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Footprints,
  MoreVertical,
  Mountain,
  SportShoe,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import {
  activityTypes,
  weeklyGoalHasTargets,
  type ActivityType,
} from "@running-club/shared";
import { ACTIVITY_LABELS, LogRunDialog } from "@/components/LogRunDialog";
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

function WeekSnapshot({ progress }: { progress: WeekProgress }) {
  const { totals, goal, progress: ratios } = progress;

  if (!weeklyGoalHasTargets(goal)) {
    return (
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
    );
  }

  const hasDistance = goal!.targetDistanceMeters != null;
  const hasDuration = goal!.targetDurationSeconds != null;
  const hasCount = goal!.targetRunCount != null;

  const primaryRatio =
    (hasDistance ? ratios.distanceRatio : null) ??
    (hasDuration ? ratios.durationRatio : null) ??
    ratios.runCountRatio;

  const sideLines: Array<{ key: string; text: ReactNode }> = [];

  if (hasDistance) {
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
  if (hasDuration) {
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
  if (hasCount) {
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

  let heroValue: ReactNode;
  let heroUnit: string | null = null;

  if (hasDistance) {
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            This week
          </p>
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
      <ProgressBar ratio={primaryRatio} />
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const className = "size-4 text-primary";
  switch (type) {
    case "run":
      return <SportShoe className={className} aria-hidden />;
    case "walk":
      return <Footprints className={className} aria-hidden />;
    case "trail":
      return <Mountain className={className} aria-hidden />;
    case "race":
      return <Trophy className={className} aria-hidden />;
    default:
      return <SportShoe className={className} aria-hidden />;
  }
}

function activityLabel(type: string): string {
  if (activityTypes.includes(type as ActivityType)) {
    return ACTIVITY_LABELS[type as ActivityType];
  }
  return type;
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
    <li
      className={cn(
        "grid items-center gap-x-3 gap-y-2 border-b border-border py-3.5 text-sm",
        "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[6.5rem_minmax(0,1.4fr)_4.5rem_5rem_4rem_2rem]",
      )}
    >
      <div className="min-w-0">
        <p className="font-medium text-foreground tabular-nums">{date}</p>
        <p className="text-xs text-muted-foreground">{weekday}</p>
      </div>

      <div className="col-span-2 flex min-w-0 items-start gap-2.5 sm:col-span-1">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary">
          <ActivityIcon type={run.activityType} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {activityLabel(run.activityType)}
          </p>
          {run.notes ? (
            <p className="truncate text-xs text-muted-foreground">{run.notes}</p>
          ) : (
            <p className="text-xs text-muted-foreground capitalize">
              {run.source}
            </p>
          )}
        </div>
      </div>

      <p className="text-right font-medium tabular-nums sm:text-left">
        {formatKm(run.distanceMeters)}{" "}
        <span className="font-normal text-muted-foreground">km</span>
      </p>

      <p className="hidden font-[family-name:var(--font-stat)] text-base font-bold tracking-tight tabular-nums sm:block">
        {formatPace(run.avgPaceSecPerKm)}
      </p>

      <p className="hidden tabular-nums text-muted-foreground sm:block">
        {formatDurationClock(run.durationSeconds)}
      </p>

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Run actions"
              disabled={deleting}
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(run)}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="col-span-2 flex justify-between gap-3 text-xs tabular-nums text-muted-foreground sm:hidden">
        <span className="font-[family-name:var(--font-stat)] text-sm font-bold text-foreground">
          {formatPace(run.avgPaceSecPerKm)}
        </span>
        <span>{formatDurationClock(run.durationSeconds)}</span>
      </div>
    </li>
  );
}

export function Home() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [week, setWeek] = useState<WeekProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [editingRun, setEditingRun] = useState<RunRecord | null>(null);

  const refresh = useCallback(() => {
    return Promise.all([listRuns(10), getWeekProgress()])
      .then(([runList, weekProgress]) => {
        setRuns(runList);
        setWeek(weekProgress);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      );
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (error) {
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
        {week ? <WeekSnapshot progress={week} /> : null}
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-primary uppercase">
            Recent runs
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

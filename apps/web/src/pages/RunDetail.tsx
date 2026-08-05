import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { HrZoneBar } from "@/components/HrZoneBar";
import { EditRunDialog } from "@/components/EditRunDialog";
import { AppLoading } from "@/components/AppLoading";
import {
  RunDetailMetrics,
  type MetricKind,
} from "@/components/RunDetailMetrics";
import { RunRouteScribble } from "@/components/RunRouteScribble";
import { RunStreamsChart } from "@/components/RunStreamsChart";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ActivityIcon, activityLabel } from "@/lib/activity";
import { deleteRun, getRun, type RunRecord } from "@/lib/api";
import {
  formatDateParts,
  formatDuration,
  formatDurationClock,
  formatKm,
  formatPace,
} from "@/lib/format";

function formatStartedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<RunRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    if (!id) return Promise.resolve();
    return getRun(id)
      .then((record) => {
        setRun(record);
        setError(null);
      })
      .catch((err) => {
        setRun(null);
        setError(err instanceof Error ? err.message : "Failed to load run");
      });
  }, [id]);

  useEffect(() => {
    if (!id) {
      setError("Missing run id");
      setLoading(false);
      return;
    }
    load().finally(() => setLoading(false));
  }, [id, load]);

  async function handleDelete() {
    if (!run) return;
    if (!window.confirm("Delete this run? This can’t be undone.")) return;
    setDeleting(true);
    try {
      await deleteRun(run.id);
      toast.success("Run deleted");
      navigate("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete run");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <AppLoading />;
  }

  if (error || !run) {
    return (
      <section className="space-y-4">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft />
            Back
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertDescription>{error ?? "Run not found"}</AlertDescription>
        </Alert>
      </section>
    );
  }

  const { date, weekday } = formatDateParts(run.startedAt, { year: true });
  const secondary: Array<{
    key: string;
    kind: MetricKind;
    label: string;
    value: string;
    unit?: string;
  }> = [
    run.trainingLoad != null
      ? {
          key: "load",
          kind: "load" as const,
          label: "Load",
          value: String(Math.round(run.trainingLoad)),
        }
      : null,
    run.intensity != null
      ? {
          key: "intensity",
          kind: "intensity" as const,
          label: "Intensity",
          value: String(Math.round(run.intensity)),
          unit: "%",
        }
      : null,
    run.gapPaceSecPerKm != null
      ? {
          key: "gap",
          kind: "gap" as const,
          label: "GAP",
          value: formatPace(run.gapPaceSecPerKm),
        }
      : null,
    run.avgHeartRate != null
      ? {
          key: "avgHr",
          kind: "avgHr" as const,
          label: "Avg HR",
          value: String(run.avgHeartRate),
          unit: "bpm",
        }
      : null,
    run.maxHeartRate != null
      ? {
          key: "maxHr",
          kind: "maxHr" as const,
          label: "Max HR",
          value: String(run.maxHeartRate),
          unit: "bpm",
        }
      : null,
    run.elevationGainMeters != null
      ? {
          key: "elev",
          kind: "elev" as const,
          label: "Elev",
          value: String(Math.round(run.elevationGainMeters)),
          unit: "m",
        }
      : null,
    run.calories != null
      ? {
          key: "calories",
          kind: "calories" as const,
          label: "Calories",
          value: String(Math.round(run.calories)),
        }
      : null,
    run.avgCadence != null
      ? {
          key: "cadence",
          kind: "cadence" as const,
          label: "Cadence",
          value: String(Math.round(run.avgCadence)),
          unit: "spm",
        }
      : null,
    run.perceivedEffort != null
      ? {
          key: "effort",
          kind: "effort" as const,
          label: "Effort",
          value: String(run.perceivedEffort),
          unit: "/10",
        }
      : null,
  ].filter((item) => item != null);

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to="/">
            <ArrowLeft />
            Back
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <ActivityIcon type={run.activityType} className="size-5 text-primary" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {activityLabel(run.activityType)}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {date} · {weekday}
            {run.source === "intervals" ? " · Intervals" : null}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-3 border-y border-border py-4">
        <div>
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">
            Pace
          </dt>
          <dd className="mt-1 font-(family-name:--font-stat) text-3xl font-bold tracking-tight tabular-nums text-foreground">
            {formatPace(run.avgPaceSecPerKm)}
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">
            Distance
          </dt>
          <dd className="mt-1 font-(family-name:--font-stat) text-3xl font-bold tracking-tight tabular-nums text-foreground">
            {formatKm(run.distanceMeters)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              km
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">
            Duration
          </dt>
          <dd className="mt-1 font-(family-name:--font-stat) text-3xl font-bold tracking-tight tabular-nums text-foreground">
            {formatDurationClock(run.durationSeconds)}
          </dd>
          <p className="text-xs text-muted-foreground">
            {formatDuration(run.durationSeconds)}
          </p>
        </div>
      </dl>

      <RunDetailMetrics metrics={secondary} />

      {run.hrZoneSeconds && run.hrZoneSeconds.some((value) => value > 0) ? (
        <HrZoneBar seconds={run.hrZoneSeconds} bpm={run.hrZoneBpm} />
      ) : null}

      {run.polyline ? <RunRouteScribble polyline={run.polyline} /> : null}

      {run.streams && run.streams.t.length > 0 ? (
        <RunStreamsChart streams={run.streams} />
      ) : null}

      {run.notes ? (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold tracking-wide text-primary uppercase">
            Notes
          </h2>
          <p className="text-sm whitespace-pre-wrap text-foreground">{run.notes}</p>
        </div>
      ) : null}

      {run.activityType !== "walk" && run.splits && run.splits.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold tracking-wide text-primary uppercase">
            Splits
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {run.splits.map((split, index) => {
              const pace =
                split.distanceMeters > 0
                  ? (split.durationSeconds / split.distanceMeters) * 1000
                  : null;
              return (
                <li
                  key={index}
                  className="flex items-center justify-between gap-3 py-3 text-sm tabular-nums"
                >
                  <span className="text-muted-foreground">{index + 1}</span>
                  <span className="text-foreground">
                    {formatKm(split.distanceMeters)} km ·{" "}
                    {formatDurationClock(split.durationSeconds)}
                    {split.avgHeartRate != null
                      ? ` · ${split.avgHeartRate} bpm`
                      : null}
                  </span>
                  <span className="font-(family-name:--font-stat) font-bold text-foreground">
                    {formatPace(pace)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <Separator />

      <p className="text-xs text-muted-foreground">
        Started {formatStartedAt(run.startedAt)}
      </p>

      <EditRunDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        run={run}
        onSaved={() => {
          void load();
        }}
      />
    </section>
  );
}

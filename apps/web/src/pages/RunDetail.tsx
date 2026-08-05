import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { HrZoneBar } from "@/components/HrZoneBar";
import { LogRunDialog } from "@/components/LogRunDialog";
import { AppLoading } from "@/components/AppLoading";
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
  const secondary = [
    run.trainingLoad != null
      ? { label: "Load", value: String(Math.round(run.trainingLoad)) }
      : null,
    run.intensity != null
      ? { label: "Intensity", value: `${Math.round(run.intensity)}%` }
      : null,
    run.gapPaceSecPerKm != null
      ? { label: "GAP", value: formatPace(run.gapPaceSecPerKm) }
      : null,
    run.avgHeartRate != null
      ? { label: "Avg HR", value: `${run.avgHeartRate} bpm` }
      : null,
    run.maxHeartRate != null
      ? { label: "Max HR", value: `${run.maxHeartRate} bpm` }
      : null,
    run.elevationGainMeters != null
      ? { label: "Elev", value: `${Math.round(run.elevationGainMeters)} m` }
      : null,
    run.calories != null
      ? { label: "Calories", value: String(Math.round(run.calories)) }
      : null,
    run.avgCadence != null
      ? { label: "Cadence", value: `${Math.round(run.avgCadence)} spm` }
      : null,
    run.perceivedEffort != null
      ? { label: "Effort", value: `${run.perceivedEffort}/10` }
      : null,
  ].filter((item): item is { label: string; value: string } => item != null);

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

      {secondary.length > 0 ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {secondary.map((item) => (
            <div key={item.label} className="flex gap-2">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="tabular-nums text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {run.hrZoneSeconds && run.hrZoneSeconds.some((value) => value > 0) ? (
        <HrZoneBar seconds={run.hrZoneSeconds} />
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

      {run.splits && run.splits.length > 0 ? (
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

      <LogRunDialog
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

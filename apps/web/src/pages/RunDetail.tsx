import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { LogRunDialog } from "@/components/LogRunDialog";
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

function DetailStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-stat)] text-2xl font-bold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  );
}

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
    return <p className="text-sm text-muted-foreground">Loading…</p>;
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

  const { date, weekday } = formatDateParts(run.startedAt);
  const hasExtras =
    run.avgHeartRate != null ||
    run.maxHeartRate != null ||
    run.elevationGainMeters != null ||
    run.calories != null ||
    run.avgCadence != null ||
    run.perceivedEffort != null;

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
          </p>
          <p className="text-sm text-muted-foreground capitalize">{run.source}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <DetailStat
          label="Distance"
          value={formatKm(run.distanceMeters)}
          sub="km"
        />
        <DetailStat
          label="Duration"
          value={formatDurationClock(run.durationSeconds)}
          sub={formatDuration(run.durationSeconds)}
        />
        <DetailStat label="Pace" value={formatPace(run.avgPaceSecPerKm)} />
      </div>

      {hasExtras ? (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold tracking-wide text-primary uppercase">
            More stats
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {run.avgHeartRate != null ? (
              <DetailStat
                label="Avg heart rate"
                value={`${run.avgHeartRate}`}
                sub="bpm"
              />
            ) : null}
            {run.maxHeartRate != null ? (
              <DetailStat
                label="Max heart rate"
                value={`${run.maxHeartRate}`}
                sub="bpm"
              />
            ) : null}
            {run.elevationGainMeters != null ? (
              <DetailStat
                label="Elevation"
                value={`${run.elevationGainMeters}`}
                sub="m"
              />
            ) : null}
            {run.calories != null ? (
              <DetailStat label="Calories" value={`${run.calories}`} />
            ) : null}
            {run.avgCadence != null ? (
              <DetailStat
                label="Cadence"
                value={`${run.avgCadence}`}
                sub="spm"
              />
            ) : null}
            {run.perceivedEffort != null ? (
              <DetailStat
                label="Effort"
                value={`${run.perceivedEffort}`}
                sub="out of 10"
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {run.notes ? (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold tracking-wide text-primary uppercase">
            Notes
          </h2>
          <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
            {run.notes}
          </p>
        </div>
      ) : null}

      {run.splits && run.splits.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold tracking-wide text-primary uppercase">
            Splits
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {run.splits.map((split, index) => {
              const pace =
                split.distanceMeters > 0
                  ? (split.durationSeconds / split.distanceMeters) * 1000
                  : null;
              return (
                <li
                  key={index}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm tabular-nums"
                >
                  <span className="text-muted-foreground">Split {index + 1}</span>
                  <span className="text-foreground">
                    {formatKm(split.distanceMeters)} km ·{" "}
                    {formatDurationClock(split.durationSeconds)}
                  </span>
                  <span className="font-[family-name:var(--font-stat)] font-bold text-foreground">
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

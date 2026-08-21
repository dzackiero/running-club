import { useEffect, useState } from "react";
import { Dumbbell, Utensils } from "lucide-react";
import { Link } from "react-router-dom";
import type { GymWorkoutRecord, MealRecord, RunRecord } from "@running-club/shared";
import { AppLoading } from "@/components/AppLoading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ActivityIcon, activityLabel } from "@/lib/activity";
import { formatDate, formatDuration, formatKm } from "@/lib/format";
import { listGymWorkouts, listRecentConfirmedMeals, listRuns } from "@/lib/api";

type HistoryItem =
  | { kind: "run"; occurredAt: string; value: RunRecord }
  | { kind: "gym"; occurredAt: string; value: GymWorkoutRecord }
  | { kind: "meal"; occurredAt: string; value: MealRecord };

function label(item: HistoryItem) {
  if (item.kind === "run") return `${formatKm(item.value.distanceMeters)} km · ${formatDuration(item.value.durationSeconds)}`;
  if (item.kind === "gym") return `${item.value.exercises.length} ${item.value.exercises.length === 1 ? "exercise" : "exercises"}`;
  return `${Math.round(item.value.totalCalories)} kcal · ${Math.round(item.value.totalProteinGrams)} g protein`;
}

function title(item: HistoryItem) {
  if (item.kind === "run") return activityLabel(item.value.activityType);
  if (item.kind === "gym") return item.value.exercises.map((exercise) => exercise.name).slice(0, 2).join(" · ") || "Gym workout";
  return item.value.items.map((meal) => meal.name).join(" · ");
}

function icon(item: HistoryItem) {
  if (item.kind === "run") return <ActivityIcon type={item.value.activityType} className="size-4 text-primary" />;
  if (item.kind === "gym") return <Dumbbell className="size-4 text-primary" aria-hidden />;
  return <Utensils className="size-4 text-primary" aria-hidden />;
}

export function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listRuns({ limit: 50 }), listGymWorkouts(), listRecentConfirmedMeals(50)])
      .then(([runs, workouts, meals]) => {
        if (cancelled) return;
        setItems([
          ...runs.map((value) => ({ kind: "run" as const, occurredAt: value.startedAt, value })),
          ...workouts.map((value) => ({ kind: "gym" as const, occurredAt: value.occurredAt, value })),
          ...meals.map((value) => ({ kind: "meal" as const, occurredAt: value.occurredAt, value })),
        ].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()));
        setError(null);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Failed to load history");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <AppLoading label="Loading history" />;
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">Personal log</p>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">Your runs, gym workouts, and confirmed meals in one timeline.</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">Your completed training and confirmed meals will appear here.</div>
      ) : (
        <ol className="divide-y divide-border rounded-lg border border-border">
          {items.map((item) => (
            <li key={`${item.kind}-${item.value.id}`} className="flex gap-3 px-4 py-3.5">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">{icon(item)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  {item.kind === "run" ? <Link to={`/runs/${item.value.id}`} className="truncate font-medium hover:text-primary">{title(item)}</Link> : <p className="truncate font-medium">{title(item)}</p>}
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.occurredAt}>{formatDate(item.occurredAt)}</time>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{label(item)}</p>
                {item.kind === "gym" && item.value.notes ? <p className="mt-1 text-xs text-muted-foreground">{item.value.notes}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

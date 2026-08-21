import type { TodayDashboard } from "@/lib/api";
import { cn } from "@/lib/utils";

function dayName(date: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function dayNumber(date: string) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(
    new Date(`${date}T12:00:00`),
  );
}

export function WeeklyOverview({ week, today }: Pick<TodayDashboard, "week"> & { today: string }) {
  const metrics = [
    { label: "Running", value: `${(week.running.distanceMeters / 1000).toFixed(week.running.distanceMeters % 1000 === 0 ? 0 : 1)} km`, detail: `${week.running.completedSessions}/${week.running.plannedSessions} sessions` },
    { label: "Gym", value: `${week.gym.completedSessions}/${week.gym.plannedSessions}`, detail: "sessions" },
    { label: "Nutrition", value: `${week.nutrition.achievedDays}/${week.nutrition.targetDays}`, detail: week.nutrition.today.targetProteinGrams != null ? `${Math.round(week.nutrition.today.proteinGrams)}/${Math.round(week.nutrition.today.targetProteinGrams)} g protein today` : "target days" },
  ];

  return (
    <section aria-labelledby="weekly-overview" className="space-y-3">
      <div>
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">This week</p>
        <h2 id="weekly-overview" className="text-xl font-semibold tracking-tight">Keep the rhythm</h2>
      </div>
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
            <p className="mt-1 font-(family-name:--font-stat) text-xl font-bold tabular-nums">{metric.value}</p>
            <p className="text-xs text-muted-foreground">{metric.detail}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" aria-label="Weekly schedule">
        {week.days.map((day) => {
          const planned = day.items.filter((item) => item.status === "planned").length;
          const done = day.items.filter((item) => item.status === "done").length;
          return (
            <div key={day.date} className={cn("min-w-0 rounded-md border px-1 py-2 text-center", day.date === today ? "border-primary bg-primary/5" : "border-border")}>
              <p className="text-[11px] font-medium text-muted-foreground">{dayName(day.date)}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{dayNumber(day.date)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{done ? `${done} done` : planned ? `${planned} planned` : "—"}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

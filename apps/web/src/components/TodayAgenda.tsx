import type { PlanOccurrenceRecord, TodayDashboard } from "@running-club/shared";
import { Check, Circle, Dumbbell, Leaf, RotateCcw, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { patchPlanOccurrence } from "@/lib/api";
import { cn } from "@/lib/utils";

type TodayAgendaProps = {
  items: PlanOccurrenceRecord[];
  nutrition: TodayDashboard["week"]["nutrition"];
  onChanged: () => void;
  onLogGym: (item: PlanOccurrenceRecord) => void;
};

const categoryMeta = {
  run: { label: "Run", icon: Circle, tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  gym: { label: "Gym", icon: Dumbbell, tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  nutrition: { label: "Nutrition", icon: Leaf, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
} as const;

function detailsLabel(item: PlanOccurrenceRecord) {
  const { details } = item;
  if (item.category === "run") {
    const runDetails = "targetDistanceMeters" in details ? details : {};
    const parts = [
      runDetails.targetDistanceMeters ? `${(runDetails.targetDistanceMeters / 1000).toFixed(runDetails.targetDistanceMeters % 1000 === 0 ? 0 : 1)} km` : null,
      runDetails.targetDurationSeconds ? `${Math.round(runDetails.targetDurationSeconds / 60)} min` : null,
      details.notes ?? null,
    ].filter(Boolean);
    return parts.join(" · ");
  }
  if (item.category === "gym") {
    const gymDetails = "templateName" in details ? details : {};
    return [gymDetails.templateName, gymDetails.focus, details.notes].filter(Boolean).join(" · ");
  }
  const nutritionDetails = "targetCalories" in details ? details : {};
  return [
    nutritionDetails.targetCalories ? `${nutritionDetails.targetCalories} kcal` : null,
    nutritionDetails.targetProteinGrams ? `${nutritionDetails.targetProteinGrams} g protein` : null,
    details.notes ?? null,
  ].filter(Boolean).join(" · ");
}

export function TodayAgenda({ items, nutrition, onChanged, onLogGym }: TodayAgendaProps) {
  const changeStatus = async (id: string, status: "planned" | "done" | "skipped") => {
    try {
      await patchPlanOccurrence(id, { status });
      toast.success(status === "planned" ? "Plan reset" : `Marked ${status}`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update plan");
    }
  };

  return (
    <section aria-labelledby="today-agenda" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">Today</p>
          <h1 id="today-agenda" className="text-2xl font-semibold tracking-tight">Your agenda</h1>
        </div>
        {items.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {items.filter((item) => item.status === "planned").length} to go
          </p>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          Add a recurring plan to see today’s agenda.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border">
          {items.map((item) => {
            const meta = categoryMeta[item.category];
            const Icon = meta.icon;
            const detail = detailsLabel(item);
            return (
              <li key={item.id} className="border-b border-border last:border-b-0">
                <div className="flex gap-3 px-3 py-3.5 sm:px-4">
                  <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md", meta.tone)}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className={cn("font-medium", item.status !== "planned" && "text-muted-foreground line-through")}>{item.title}</p>
                      <span className="text-xs font-medium capitalize text-muted-foreground">{item.status}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{meta.label}{detail ? ` · ${detail}` : ""}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.status === "planned" ? (
                        <>
                          {item.category === "gym" ? (
                            <Button type="button" size="sm" onClick={() => onLogGym(item)}>Log workout</Button>
                          ) : null}
                          <Button type="button" size="sm" variant={item.category === "gym" ? "outline" : "default"} onClick={() => void changeStatus(item.id, "done")}>
                            <Check /> Mark done
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => void changeStatus(item.id, "skipped")}>
                            <SkipForward /> Skip
                          </Button>
                        </>
                      ) : (
                        <Button type="button" size="sm" variant="ghost" onClick={() => void changeStatus(item.id, "planned")}>
                          <RotateCcw /> Mark planned
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {nutrition.today.targetProteinGrams != null ? <p className="text-sm text-muted-foreground">Protein today: {Math.round(nutrition.today.proteinGrams)} / {Math.round(nutrition.today.targetProteinGrams)} g. Log meals through MCP, then confirm the draft before it counts.</p> : null}
    </section>
  );
}

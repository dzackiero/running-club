import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  activityTypes,
  type ActivityType,
  type RunRecord,
} from "@running-club/shared";
import { NumberStepper } from "@/components/NumberStepper";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ACTIVITY_LABELS } from "@/lib/activity";
import { createRun, updateRun } from "@/lib/api";
import { formatPace } from "@/lib/format";
import { cn } from "@/lib/utils";

function avgPaceSecPerKm(
  distanceKm: number,
  durationMinutes: number,
): number | null {
  if (distanceKm <= 0 || durationMinutes <= 0) return null;
  return (durationMinutes * 60) / distanceKm;
}

function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type LogRunDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run?: RunRecord | null;
  onSaved?: () => void;
};

export function LogRunDialog({
  open,
  onOpenChange,
  run = null,
  onSaved,
}: LogRunDialogProps) {
  const editing = run != null;

  const [startedAt, setStartedAt] = useState(() =>
    toDatetimeLocalValue(new Date()),
  );
  const [distanceKm, setDistanceKm] = useState(5);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [activityType, setActivityType] = useState<ActivityType>("run");
  const [notes, setNotes] = useState("");
  const [avgHeartRate, setAvgHeartRate] = useState("");
  const [maxHeartRate, setMaxHeartRate] = useState("");
  const [elevationGainMeters, setElevationGainMeters] = useState("");
  const [calories, setCalories] = useState("");
  const [avgCadence, setAvgCadence] = useState("");
  const [perceivedEffort, setPerceivedEffort] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (run) {
      setStartedAt(toDatetimeLocalValue(new Date(run.startedAt)));
      setDistanceKm(Math.round((run.distanceMeters / 1000) * 10) / 10);
      setDurationMinutes(Math.max(1, Math.round(run.durationSeconds / 60)));
      setActivityType(
        activityTypes.includes(run.activityType as ActivityType)
          ? (run.activityType as ActivityType)
          : "run",
      );
      setNotes(run.notes ?? "");
      setAvgHeartRate(run.avgHeartRate?.toString() ?? "");
      setMaxHeartRate(run.maxHeartRate?.toString() ?? "");
      setElevationGainMeters(run.elevationGainMeters?.toString() ?? "");
      setCalories(run.calories?.toString() ?? "");
      setAvgCadence(run.avgCadence?.toString() ?? "");
      setPerceivedEffort(run.perceivedEffort?.toString() ?? "");
      setMoreOpen(
        run.avgHeartRate != null ||
          run.maxHeartRate != null ||
          run.elevationGainMeters != null ||
          run.calories != null ||
          run.avgCadence != null ||
          run.perceivedEffort != null,
      );
      return;
    }

    setStartedAt(toDatetimeLocalValue(new Date()));
    setDistanceKm(5);
    setDurationMinutes(30);
    setActivityType("run");
    setNotes("");
    setAvgHeartRate("");
    setMaxHeartRate("");
    setElevationGainMeters("");
    setCalories("");
    setAvgCadence("");
    setPerceivedEffort("");
    setMoreOpen(false);
  }, [open, run]);

  const pace = useMemo(
    () => avgPaceSecPerKm(distanceKm, durationMinutes),
    [distanceKm, durationMinutes],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const started = new Date(startedAt);
    if (Number.isNaN(started.getTime())) {
      toast.error("Pick a valid date and time");
      return;
    }
    if (distanceKm <= 0) {
      toast.error("Distance must be greater than 0");
      return;
    }
    if (durationMinutes <= 0) {
      toast.error("Duration must be greater than 0");
      return;
    }

    const avgHr = parseOptionalNumber(avgHeartRate);
    const maxHr = parseOptionalNumber(maxHeartRate);
    const elevation = parseOptionalNumber(elevationGainMeters);
    const cals = parseOptionalNumber(calories);
    const cadence = parseOptionalNumber(avgCadence);
    const effort = parseOptionalNumber(perceivedEffort);

    if (
      effort != null &&
      (effort < 1 || effort > 10 || !Number.isInteger(effort))
    ) {
      toast.error("Perceived effort must be a whole number from 1 to 10");
      return;
    }

    const payload = {
      startedAt: started.toISOString(),
      distanceMeters: Math.round(distanceKm * 1000),
      durationSeconds: Math.round(durationMinutes * 60),
      activityType,
      notes: notes.trim() || undefined,
      avgHeartRate: avgHr,
      maxHeartRate: maxHr,
      elevationGainMeters: elevation,
      calories: cals,
      avgCadence: cadence,
      perceivedEffort: effort,
      source: "manual" as const,
    };

    setSaving(true);
    try {
      if (editing && run) {
        await updateRun(run.id, payload);
        toast.success("Run updated");
      } else {
        await createRun(payload);
        toast.success("Run logged");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : editing
            ? "Failed to update run"
            : "Failed to log run",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit run" : "Log a run"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update distance, time, or details."
              : "Distance, time, and when you went out."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="log-started-at">When</Label>
            <Input
              id="log-started-at"
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Activity</p>
            <div className="flex flex-wrap gap-2">
              {activityTypes.map((type) => (
                <Button
                  key={type}
                  type="button"
                  size="sm"
                  variant={activityType === type ? "default" : "outline"}
                  onClick={() => setActivityType(type)}
                >
                  {ACTIVITY_LABELS[type]}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-1">
            <p className="text-center text-sm font-medium">Distance</p>
            <NumberStepper
              value={distanceKm}
              onChange={setDistanceKm}
              step={0.5}
              min={0.5}
              max={100}
              unit="kilometers"
              aria-label="Distance in kilometers"
              formatValue={(v) => v.toFixed(v % 1 === 0 ? 0 : 1)}
            />
          </div>

          <Separator />

          <div className="space-y-1">
            <p className="text-center text-sm font-medium">Duration</p>
            <NumberStepper
              value={durationMinutes}
              onChange={setDurationMinutes}
              step={1}
              min={1}
              max={600}
              unit="minutes"
              aria-label="Duration in minutes"
            />
          </div>

          <div
            className={cn(
              "rounded-lg bg-secondary/60 px-4 py-3 text-center",
              pace == null && "opacity-50",
            )}
          >
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Avg pace
            </p>
            <p className="mt-1 font-[family-name:var(--font-stat)] text-3xl font-bold tracking-tight tabular-nums">
              {formatPace(pace)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="log-notes">Notes (optional)</Label>
            <Input
              id="log-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Easy miles, felt good…"
              maxLength={2000}
            />
          </div>

          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between px-0 text-muted-foreground hover:text-foreground"
              >
                More details
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    moreOpen && "rotate-180",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <OptionalNumberField
                  id="avg-hr"
                  label="Avg HR"
                  unit="bpm"
                  value={avgHeartRate}
                  onChange={setAvgHeartRate}
                />
                <OptionalNumberField
                  id="max-hr"
                  label="Max HR"
                  unit="bpm"
                  value={maxHeartRate}
                  onChange={setMaxHeartRate}
                />
                <OptionalNumberField
                  id="elevation"
                  label="Elevation"
                  unit="m"
                  value={elevationGainMeters}
                  onChange={setElevationGainMeters}
                />
                <OptionalNumberField
                  id="calories"
                  label="Calories"
                  unit="kcal"
                  value={calories}
                  onChange={setCalories}
                />
                <OptionalNumberField
                  id="cadence"
                  label="Cadence"
                  unit="spm"
                  value={avgCadence}
                  onChange={setAvgCadence}
                  step="0.1"
                />
                <OptionalNumberField
                  id="effort"
                  label="Effort"
                  unit="1–10"
                  value={perceivedEffort}
                  onChange={setPerceivedEffort}
                  min={1}
                  max={10}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Log run"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OptionalNumberField({
  id,
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step = "1",
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}{" "}
        <span className="font-normal text-muted-foreground">({unit})</span>
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        placeholder="—"
      />
    </div>
  );
}

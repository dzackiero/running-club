import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppLoading } from "@/components/AppLoading";
import { NumberStepper } from "@/components/NumberStepper";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { getCurrentGoal, putCurrentGoal } from "@/lib/api";
import { cn } from "@/lib/utils";

export function Goal() {
  const [weekStartsOn, setWeekStartsOn] = useState(1);
  const [distanceOn, setDistanceOn] = useState(false);
  const [durationOn, setDurationOn] = useState(false);
  const [countOn, setCountOn] = useState(false);
  const [distanceKm, setDistanceKm] = useState(20);
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [runCount, setRunCount] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentGoal()
      .then((goal) => {
        if (!goal) return;
        setWeekStartsOn(goal.weekStartsOn);
        if (goal.targetDistanceMeters != null) {
          setDistanceOn(true);
          setDistanceKm(
            Math.round((goal.targetDistanceMeters / 1000) * 10) / 10,
          );
        }
        if (goal.targetDurationSeconds != null) {
          setDurationOn(true);
          setDurationMinutes(Math.round(goal.targetDurationSeconds / 60));
        }
        if (goal.targetRunCount != null) {
          setCountOn(true);
          setRunCount(goal.targetRunCount);
        }
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Failed to load goal"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function clearAll() {
    setDistanceOn(false);
    setDurationOn(false);
    setCountOn(false);
    setSaving(true);
    try {
      await putCurrentGoal({ weekStartsOn });
      toast.success("Weekly targets cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear goal");
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    const body: {
      weekStartsOn: number;
      targetDistanceMeters?: number;
      targetDurationSeconds?: number;
      targetRunCount?: number;
    } = { weekStartsOn };

    if (distanceOn) {
      body.targetDistanceMeters = Math.round(distanceKm * 1000);
    }
    if (durationOn) {
      body.targetDurationSeconds = Math.round(durationMinutes * 60);
    }
    if (countOn) {
      body.targetRunCount = runCount;
    }

    const anyOn = distanceOn || durationOn || countOn;

    try {
      await putCurrentGoal(body);
      toast.success(anyOn ? "Goal saved" : "Weekly targets cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save goal");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AppLoading />;
  }

  const anyOn = distanceOn || durationOn || countOn;

  return (
    <section className="mx-auto w-full max-w-lg space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Weekly goal</h1>
        <p className="text-sm text-muted-foreground">
          Choose what you want to hit this week. You can leave some off.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-0">
        <MetricBlock
          label="Distance"
          checked={distanceOn}
          onCheckedChange={setDistanceOn}
        >
          <NumberStepper
            value={distanceKm}
            onChange={setDistanceKm}
            step={1}
            min={1}
            max={200}
            unit="kilometers / week"
            aria-label="Distance in kilometers"
            formatValue={(v) => v.toFixed(v % 1 === 0 ? 0 : 1)}
          />
        </MetricBlock>

        <Separator />

        <MetricBlock
          label="Duration"
          checked={durationOn}
          onCheckedChange={setDurationOn}
        >
          <NumberStepper
            value={durationMinutes}
            onChange={setDurationMinutes}
            step={15}
            min={15}
            max={1200}
            unit="minutes / week"
            aria-label="Duration in minutes"
          />
        </MetricBlock>

        <Separator />

        <MetricBlock
          label="Run count"
          checked={countOn}
          onCheckedChange={setCountOn}
        >
          <NumberStepper
            value={runCount}
            onChange={setRunCount}
            step={1}
            min={1}
            max={14}
            unit="runs / week"
            aria-label="Run count"
          />
        </MetricBlock>

        <Separator className="mb-6" />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" className="flex-1" disabled={saving} size="lg">
            {saving ? "Saving…" : anyOn ? "Save goal" : "Clear targets"}
          </Button>
          {anyOn ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={saving}
              onClick={clearAll}
            >
              Clear all
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function MetricBlock({
  label,
  checked,
  onCheckedChange,
  children,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className={cn("py-6", !checked && "opacity-70")}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Label
          htmlFor={`${label}-toggle`}
          className="cursor-pointer text-base font-medium"
        >
          {label}
        </Label>
        <Switch
          id={`${label}-toggle`}
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {checked ? (
        children
      ) : (
        <p className="text-sm text-muted-foreground">Off — not tracked</p>
      )}
    </div>
  );
}

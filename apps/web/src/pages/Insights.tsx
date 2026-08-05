import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { InsightsGrain } from "@running-club/shared";
import { AppLoading } from "@/components/AppLoading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInsightsOverview, type InsightsOverview } from "@/lib/api";
import { formatKm, formatPace, formatWeekRange } from "@/lib/format";
import { cn } from "@/lib/utils";

type Preset = "this_month" | "last_month" | "last_3_months" | "ytd" | "custom";

const PRESET_LABELS: Record<Preset, string> = {
  this_month: "This month",
  last_month: "Last month",
  last_3_months: "Last 3 months",
  ytd: "Year to date",
  custom: "Custom",
};

const GRAIN_OPTIONS: { value: InsightsGrain; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

function endOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999),
  );
}

function toDateInputValue(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toISOString().slice(0, 10);
}

function fromDateInput(value: string, endOfDay: boolean): string {
  const [y, m, day] = value.split("-").map(Number);
  if (endOfDay) {
    return new Date(Date.UTC(y, m - 1, day, 23, 59, 59, 999)).toISOString();
  }
  return new Date(Date.UTC(y, m - 1, day)).toISOString();
}

function rangeForPreset(
  preset: Exclude<Preset, "custom">,
  now: Date = new Date(),
): { from: string; to: string } {
  const to = endOfUtcDay(now);
  switch (preset) {
    case "this_month": {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case "last_month": {
      const from = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      );
      const last = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999),
      );
      return { from: from.toISOString(), to: last.toISOString() };
    }
    case "last_3_months": {
      const from = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1),
      );
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case "ytd": {
      const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      return { from: from.toISOString(), to: to.toISOString() };
    }
  }
}

function periodLengthDays(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const start = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

/** Sensible default when the date range changes. */
function defaultGrainForRange(fromIso: string, toIso: string): InsightsGrain {
  const days = periodLengthDays(fromIso, toIso);
  if (days <= 14) return "day";
  if (days <= 42) return "week";
  return "month";
}

function formatDelta(pct: number | null, opts?: { invert?: boolean }): string {
  if (pct == null) return "—";
  const value = opts?.invert ? -pct : pct;
  if (Math.abs(value) < 0.5) return "same";
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

function deltaTone(
  pct: number | null,
  opts?: { invert?: boolean },
): "up" | "down" | "flat" {
  if (pct == null) return "flat";
  const value = opts?.invert ? -pct : pct;
  if (Math.abs(value) < 0.5) return "flat";
  return value > 0 ? "up" : "down";
}

function DeltaLine({ pct, invert }: { pct: number | null; invert?: boolean }) {
  const tone = deltaTone(pct, { invert });
  return (
    <p
      className={cn(
        "mt-1.5 text-sm font-medium tabular-nums",
        tone === "up" && "text-(--rc-good)",
        tone !== "up" && "text-muted-foreground",
      )}
    >
      vs prior · {formatDelta(pct, { invert })}
    </p>
  );
}

const distanceChartConfig = {
  km: {
    label: "Distance",
    color: "var(--rc-lane)",
  },
} satisfies ChartConfig;

function bucketLabel(startIso: string, grain: InsightsGrain): string {
  const start = new Date(startIso);
  if (grain === "month") {
    return start.toLocaleDateString(undefined, {
      month: "short",
      timeZone: "UTC",
    });
  }
  return start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function TrendChart({
  buckets,
  grain,
}: {
  buckets: InsightsOverview["buckets"];
  grain: InsightsGrain;
}) {
  const chartData = useMemo(
    () =>
      buckets.map((bucket) => ({
        label: bucketLabel(bucket.start, grain),
        km: Number(formatKm(bucket.distanceMeters)),
        runs: bucket.runCount,
      })),
    [buckets, grain],
  );

  return (
    <ChartContainer
      config={distanceChartConfig}
      className="aspect-auto h-55 w-full"
    >
      <BarChart
        accessibilityLayer
        data={chartData}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={grain === "day" ? 24 : 8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          width={36}
          tickFormatter={(value) => String(value)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="font-medium tabular-nums text-foreground">
                  {Number(value).toFixed(1)} km
                </span>
              )}
            />
          }
        />
        <Bar
          dataKey="km"
          fill="var(--color-km)"
          radius={[4, 4, 0, 0]}
          maxBarSize={grain === "day" ? 28 : 48}
        />
      </BarChart>
    </ChartContainer>
  );
}

function GrainToggle({
  value,
  onChange,
}: {
  value: InsightsGrain;
  onChange: (grain: InsightsGrain) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-border bg-background p-0.5"
      role="group"
      aria-label="Chart grouping"
    >
      {GRAIN_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MiniStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-(family-name:--font-stat) text-2xl font-bold tracking-tight tabular-nums text-foreground">
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-semibold text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

export function Insights() {
  const initialRange = rangeForPreset("this_month");
  const [preset, setPreset] = useState<Preset>("this_month");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [grain, setGrain] = useState<InsightsGrain>(() =>
    defaultGrainForRange(initialRange.from, initialRange.to),
  );
  const [customFrom, setCustomFrom] = useState(() =>
    toDateInputValue(initialRange.from),
  );
  const [customTo, setCustomTo] = useState(() =>
    toDateInputValue(initialRange.to),
  );

  const [data, setData] = useState<InsightsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getInsightsOverview(from, to, grain)
      .then((overview) => {
        if (cancelled) return;
        setData(overview);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, grain]);

  function applyRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    setGrain(defaultGrainForRange(nextFrom, nextTo));
    setCustomFrom(toDateInputValue(nextFrom));
    setCustomTo(toDateInputValue(nextTo));
  }

  function applyPreset(next: Preset) {
    setPreset(next);
    if (next === "custom") {
      setCustomFrom(toDateInputValue(from));
      setCustomTo(toDateInputValue(to));
      return;
    }
    const range = rangeForPreset(next);
    applyRange(range.from, range.to);
  }

  function applyCustom() {
    if (!customFrom || !customTo || customFrom > customTo) {
      setError("Pick a valid date range");
      return;
    }
    setPreset("custom");
    applyRange(fromDateInput(customFrom, false), fromDateInput(customTo, true));
  }

  if (loading && !data) {
    return <AppLoading />;
  }

  if ((error && !data) || (!loading && !data)) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Couldn’t load insights"}</AlertDescription>
      </Alert>
    );
  }

  const overview = data!;
  const rangeLabel = formatWeekRange(
    new Date(overview.from),
    new Date(overview.to),
  );
  const hasGoalWeeks = overview.goals.hit + overview.goals.missed > 0;

  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Insights</h1>
          <p className="text-base text-muted-foreground">{rangeLabel}</p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <Select
            value={preset}
            onValueChange={(value) => applyPreset(value as Preset)}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRESET_LABELS) as Preset[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {PRESET_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {preset === "custom" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="From date"
                className="w-38"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="To date"
                className="w-38"
              />
              <Button type="button" size="sm" onClick={applyCustom}>
                Apply
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {overview.sparse ? (
        <div className="rounded-xl border border-border bg-card px-5 py-10 text-center">
          <p className="text-base text-muted-foreground">
            Log a few more runs and this page fills in.
          </p>
          <Link
            to="/"
            className="mt-3 inline-block text-base font-medium text-primary underline-offset-4 hover:underline"
          >
            Back home
          </Link>
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card px-4 py-5 sm:px-6 sm:py-6">
            <div className="grid gap-6 sm:grid-cols-3 sm:gap-0">
              <div className="sm:pr-6">
                <p className="text-sm text-muted-foreground">Distance</p>
                <p className="stat-hero mt-2 text-5xl font-bold tracking-tight tabular-nums text-foreground sm:text-6xl">
                  {formatKm(overview.totals.distanceMeters)}
                  <span className="ml-1.5 text-2xl font-semibold text-muted-foreground">
                    km
                  </span>
                </p>
                <DeltaLine pct={overview.deltas.distancePct} />
              </div>
              <div className="sm:border-border sm:border-l sm:px-6">
                <p className="text-sm text-muted-foreground">Runs</p>
                <p className="stat-hero mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground sm:text-4xl">
                  {overview.totals.runCount}
                </p>
                <DeltaLine pct={overview.deltas.runCountPct} />
              </div>
              <div className="sm:border-border sm:border-l sm:pl-6">
                <p className="text-sm text-muted-foreground">Avg pace</p>
                <p className="stat-hero mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground sm:text-4xl">
                  {formatPace(overview.totals.avgPaceSecPerKm)}
                </p>
                <DeltaLine pct={overview.deltas.pacePct} invert />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">
                Distance
              </h2>
              <GrainToggle value={grain} onChange={setGrain} />
            </div>
            <div
              className={cn(
                "mt-5 transition-opacity duration-150",
                loading && "opacity-50",
              )}
            >
              <TrendChart buckets={overview.buckets} grain={overview.grain} />
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            <div className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5 sm:py-5">
              <h2 className="text-sm font-semibold text-foreground">
                Consistency
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <MiniStat
                  label="Days ran"
                  value={String(overview.consistency.daysWithRun)}
                />
                <MiniStat
                  label="Longest gap"
                  value={String(overview.consistency.longestGapDays)}
                  unit={
                    overview.consistency.longestGapDays === 1 ? "day" : "days"
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Goals</h2>
                <Link
                  to="/goal"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {hasGoalWeeks ? "Edit" : "Set goal"}
                </Link>
              </div>
              {hasGoalWeeks ? (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <MiniStat label="Hit" value={String(overview.goals.hit)} />
                  <MiniStat
                    label="Missed"
                    value={String(overview.goals.missed)}
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No weekly target in this range.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

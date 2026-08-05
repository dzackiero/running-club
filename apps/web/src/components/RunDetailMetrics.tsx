import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  AnalyticsUpIcon,
  FireIcon,
  FlashIcon,
  HeartPulseIcon,
  MountainIcon,
  Pulse02Icon,
  RunningShoesIcon,
  WalkingIcon,
  WorkoutWarmUpIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

type Tone = "lane" | "sky" | "pulse" | "fuel" | "ink";

type Metric = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  icon: IconSvgElement;
  tone: Tone;
};

const toneClass: Record<Tone, string> = {
  lane: "bg-primary/10 text-primary",
  sky: "bg-[color-mix(in_oklab,var(--rc-sky)_32%,transparent)] text-primary/80",
  pulse: "bg-destructive/10 text-destructive",
  fuel: "bg-[color-mix(in_oklab,var(--rc-good)_14%,transparent)] text-[var(--rc-good)]",
  ink: "bg-secondary text-muted-foreground",
};

export function RunDetailMetrics({
  metrics,
}: {
  metrics: Array<Omit<Metric, "icon" | "tone"> & { kind: MetricKind }>;
}) {
  if (metrics.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
      {metrics.map((metric) => {
        const { icon, tone } = kindStyle[metric.kind];
        return (
          <div key={metric.key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md",
                  toneClass[tone],
                )}
              >
                <HugeiconsIcon icon={icon} size={14} strokeWidth={1.75} />
              </span>
              {metric.label}
            </dt>
            <dd className="mt-1 pl-7.5 font-(family-name:--font-stat) text-xl font-bold tracking-tight tabular-nums text-foreground">
              {metric.value}
              {metric.unit ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {metric.unit}
                </span>
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export type MetricKind =
  | "load"
  | "intensity"
  | "gap"
  | "avgHr"
  | "maxHr"
  | "elev"
  | "calories"
  | "cadence"
  | "effort";

const kindStyle: Record<MetricKind, { icon: IconSvgElement; tone: Tone }> = {
  load: { icon: AnalyticsUpIcon, tone: "lane" },
  intensity: { icon: FlashIcon, tone: "sky" },
  gap: { icon: RunningShoesIcon, tone: "lane" },
  avgHr: { icon: HeartPulseIcon, tone: "pulse" },
  maxHr: { icon: Pulse02Icon, tone: "pulse" },
  elev: { icon: MountainIcon, tone: "ink" },
  calories: { icon: FireIcon, tone: "fuel" },
  cadence: { icon: WalkingIcon, tone: "sky" },
  effort: { icon: WorkoutWarmUpIcon, tone: "ink" },
};

import { formatDurationClock } from "@/lib/format";
import { formatHrZoneRange } from "@/lib/hr-zones";

const ZONES = [
  { name: "Endurance", bar: "#A8B0B8" },
  { name: "Moderate", bar: "#4BA3F5" },
  { name: "Tempo", bar: "#3CCF70" },
  { name: "Threshold", bar: "#F5C400" },
  { name: "Anaerobic", bar: "#F0463C" },
  { name: "VO2 Max", bar: "#C026D3" },
  { name: "Neuromuscular", bar: "#7C3AED" },
] as const;

export function HrZoneBar({
  seconds,
  bpm,
}: {
  seconds: number[];
  bpm?: number[] | null;
}) {
  const total = seconds.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold tracking-wide text-primary uppercase">
        Heart rate zones
      </h2>

      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {seconds.map((value, index) => {
          const safe = Math.max(0, value);
          if (safe <= 0) return null;
          const zone = ZONES[index];
          return (
            <div
              key={index}
              className="h-full"
              style={{
                width: `${(safe / total) * 100}%`,
                backgroundColor: zone?.bar ?? "#64748B",
              }}
            />
          );
        })}
      </div>

      <ul className="space-y-3">
        {seconds.map((value, index) => {
          const zone = ZONES[index] ?? {
            name: `Zone ${index + 1}`,
            bar: "#64748B",
          };
          const safe = Math.max(0, value);
          const pct = (safe / total) * 100;
          const range = formatHrZoneRange(index, bpm, seconds.length);
          return (
            <li key={index} className="space-y-1">
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm text-[11px] font-semibold text-white"
                    style={{ backgroundColor: zone.bar }}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{zone.name}</span>
                    {range ? (
                      <span className="block text-xs text-muted-foreground">
                        {range}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 text-right font-(family-name:--font-stat) text-sm font-bold tabular-nums text-foreground">
                  {formatDurationClock(safe)}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {Math.round(pct)}%
                  </span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: zone.bar,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

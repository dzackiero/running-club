import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

const ZONE_TONES = [
  "bg-primary",
  "bg-primary/80",
  "bg-primary/60",
  "bg-sky-400/80",
  "bg-muted-foreground/40",
  "bg-muted-foreground/25",
  "bg-muted-foreground/15",
];

export function HrZoneBar({ seconds }: { seconds: number[] }) {
  const total = seconds.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold tracking-wide text-primary uppercase">
        HR zones
      </h2>
      <div className="flex h-3 overflow-hidden rounded-sm bg-muted">
        {seconds.map((value, index) =>
          value > 0 ? (
            <div
              key={index}
              className={cn(ZONE_TONES[index % ZONE_TONES.length])}
              style={{ flexGrow: value }}
              title={`Z${index + 1} · ${formatDuration(value)}`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
        {seconds.map((value, index) =>
          value > 0 ? (
            <span key={index}>
              Z{index + 1} {formatDuration(value)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

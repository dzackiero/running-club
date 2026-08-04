import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  formatValue?: (value: number) => string;
  className?: string;
  "aria-label"?: string;
};

function roundToStep(value: number, step: number): number {
  const decimals = String(step).includes(".")
    ? (String(step).split(".")[1]?.length ?? 0)
    : 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  unit,
  formatValue,
  className,
  "aria-label": ariaLabel = "Value",
}: NumberStepperProps) {
  const display = formatValue ? formatValue(value) : String(value);
  const [draft, setDraft] = useState(display);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(display);
  }, [display, focused]);

  function bump(direction: -1 | 1) {
    const next = roundToStep(value + direction * step, step);
    onChange(clamp(next, min, max));
  }

  function commitDraft(raw: string) {
    const parsed = Number.parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setDraft(display);
      return;
    }
    onChange(clamp(roundToStep(parsed, step), min, max));
  }

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="flex items-center gap-3 sm:gap-5">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-11 shrink-0 rounded-full border-border bg-card"
          onClick={() => bump(-1)}
          disabled={value <= min}
          aria-label={`Decrease ${ariaLabel}`}
        >
          <Minus className="size-5" />
        </Button>

        <input
          type="text"
          inputMode="decimal"
          value={focused ? draft : display}
          aria-label={ariaLabel}
          onFocus={(e) => {
            setFocused(true);
            setDraft(display);
            e.target.select();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setFocused(false);
            commitDraft(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              bump(1);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              bump(-1);
            }
          }}
          className={cn(
            "min-w-[4.5rem] max-w-[7rem] bg-transparent text-center tabular-nums outline-none",
            "font-[family-name:var(--font-stat)] text-5xl leading-none font-bold tracking-tight text-foreground sm:text-6xl",
            "rounded-md border border-transparent px-1 py-0.5",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        />

        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-11 shrink-0 rounded-full border-border bg-card"
          onClick={() => bump(1)}
          disabled={value >= max}
          aria-label={`Increase ${ariaLabel}`}
        >
          <Plus className="size-5" />
        </Button>
      </div>
      {unit ? (
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {unit}
        </p>
      ) : null}
    </div>
  );
}

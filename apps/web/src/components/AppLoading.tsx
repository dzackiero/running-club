import { SportShoe } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppLoading({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[40vh] flex-col items-center justify-center gap-4",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="app-loading-track relative h-14 w-28" aria-hidden>
        <SportShoe className="app-loading-shoe app-loading-shoe-left size-9 text-primary" />
        <SportShoe className="app-loading-shoe app-loading-shoe-right size-9 text-primary" />
        <span className="app-loading-print app-loading-print-1" />
        <span className="app-loading-print app-loading-print-2" />
        <span className="app-loading-print app-loading-print-3" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <span className="sr-only">{label}</span>
    </div>
  );
}

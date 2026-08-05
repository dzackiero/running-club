import { Spinner } from "@/components/ui/spinner";
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
        "flex min-h-[40vh] flex-col items-center justify-center gap-3",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spinner className="size-6 text-primary motion-reduce:animate-none" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

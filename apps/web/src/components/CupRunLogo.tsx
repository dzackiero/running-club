import { cn } from "@/lib/utils";

export function CupRunLogo({
  className,
  title = "CUP Run",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={cn("size-7 shrink-0 text-foreground", className)}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect
        x="3.25"
        y="5.25"
        width="18.5"
        height="21.5"
        rx="10.75"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <rect x="8" y="10.25" width="9" height="11.5" rx="4.5" fill="currentColor" />
      <path
        d="M21.75 11.25c3.55.15 5.75 2.35 5.75 4.75s-2.2 4.6-5.75 4.75"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CupRunWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[1.05rem] font-semibold leading-none tracking-tight text-foreground">
        CUP Run
      </span>
      <span className="text-[0.625rem] leading-none text-muted-foreground">
        Coffee Unite People
      </span>
    </span>
  );
}

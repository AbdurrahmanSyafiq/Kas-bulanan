import { cn } from "@/lib/utils";

const STROKE = {
  ok: "stroke-ok",
  warn: "stroke-warn",
  danger: "stroke-danger",
  muted: "stroke-muted-foreground/40",
} as const;

const R = 18;
const C = 2 * Math.PI * R;

/** Cincin progres kecil. `pct` 0 sampai 1; lebih dari 1 tetap digambar penuh. */
export function Ring({
  label,
  pct,
  tone,
  className,
}: {
  label: string;
  pct: number;
  tone: keyof typeof STROKE;
  className?: string;
}) {
  const value = Math.max(0, Math.min(pct, 1));
  return (
    <svg
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      viewBox="0 0 48 48"
      className={cn("size-12 shrink-0", className)}
    >
      <circle cx="24" cy="24" r={R} fill="none" strokeWidth="6" className="stroke-muted" />
      {value > 0 && (
        <circle
          cx="24"
          cy="24"
          r={R}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${value * C} ${C}`}
          transform="rotate(-90 24 24)"
          className={cn("transition-[stroke-dasharray] duration-500", STROKE[tone])}
        />
      )}
    </svg>
  );
}
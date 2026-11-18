import type { CategoryStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONES = {
  ok: "bg-primary",
  warn: "bg-warn",
  danger: "bg-danger",
  muted: "bg-muted-foreground/60",
} as const;

export function Meter({
  label,
  pct,
  tone = "ok",
  className,
}: {
  label: string;
  /** 0 sampai 1 (lebih dari 1 tetap digambar penuh). */
  pct: number;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const width = Math.max(0, Math.min(pct, 1)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", TONES[tone])}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function toneFor(pct: number): "ok" | "warn" | "danger" {
  return pct >= 1 ? "danger" : pct >= 0.8 ? "warn" : "ok";
}

export function toneOfStatus(status: CategoryStatus): "ok" | "warn" | "danger" {
  return status === "over" ? "danger" : status === "waspada" || status === "habis" ? "warn" : "ok";
}

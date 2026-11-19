import { addDays, shortDate } from "@/lib/dates";
import { formatIDR } from "@/lib/money";
import type { Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DailyBars({ snap }: { snap: Snapshot }) {
  const { daily, period } = snap;
  const max = Math.max(...daily.map((d) => d.amount), 1);
  const top = daily.reduce(
    (best, d) => (d.amount > best.amount ? d : best),
    daily[0],
  );

  return (
    <section
      aria-labelledby="daily-title"
      className="rounded-[20px] border border-border bg-card p-5">
      <h2 id="daily-title" className="text-lg">
        Pengeluaran per hari
      </h2>
      <p className="mt-1 text-sm text-muted-foreground tabular-nums">
        {top.amount > 0
          ? `Terbesar ${shortDate(top.date)}, ${formatIDR(top.amount)}.`
          : "Belum ada pengeluaran di periode ini."}
      </p>

      <ul
        className="mt-4 flex h-28 items-end gap-[3px]"
        aria-label="Grafik pengeluaran per hari">
        {daily.map((d) => (
          <li
            key={d.date}
            title={`${shortDate(d.date)}: ${formatIDR(d.amount)}`}
            className="flex h-full min-w-0 flex-1 items-end">
            <span className="sr-only">
              {shortDate(d.date)}: {formatIDR(d.amount)}
            </span>
            <span
              aria-hidden
              className={cn(
                "block w-full rounded-t-[3px]",
                d.isToday
                  ? "bg-primary"
                  : d.amount > 0
                    ? "bg-primary/50"
                    : d.future || d.weekend
                      ? "bg-border/60"
                      : "bg-border",
              )}
              style={{
                height:
                  d.amount > 0
                    ? `${Math.max((d.amount / max) * 100, 5)}%`
                    : "3px",
              }}
            />
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
        <span>{shortDate(period.start)}</span>
        <span>{shortDate(addDays(period.endExclusive, -1))}</span>
      </div>
    </section>
  );
}

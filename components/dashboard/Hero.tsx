"use client";

import { useState } from "react";
import { addDays, shortDate } from "@/lib/dates";
import { formatIDR } from "@/lib/money";
import type { Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { fieldClass, type Act } from "./helpers";
import { Meter, toneFor } from "./Meter";

export function Hero({ snap, act, busy }: { snap: Snapshot; act: Act; busy: boolean }) {
  const { totals, period } = snap;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const spentPct = Math.round(totals.pct * 100);
  const lastDay = addDays(period.endExclusive, -1);

  return (
    <section aria-label="Ringkasan budget" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
      <div>
        <p className="text-sm text-muted-foreground">Sisa budget</p>
        <p
          className={cn(
            "font-display text-[clamp(2.75rem,8vw,4.75rem)] leading-none font-semibold tracking-tight tabular-nums",
            totals.remaining < 0 && "text-danger",
          )}
        >
          {formatIDR(totals.remaining)}
        </p>
        <p className="mt-3 text-sm text-muted-foreground tabular-nums">
          {formatIDR(totals.spent)} terpakai dari {formatIDR(totals.budget)}
          {!editing && (
            <button
              type="button"
              className="ml-2 rounded-sm underline underline-offset-4 hover:text-foreground"
              onClick={() => {
                setValue(String(totals.budget));
                setEditing(true);
              }}
            >
              Ubah total
            </button>
          )}
        </p>

        {editing && (
          <form
            className="mt-4 flex max-w-md flex-wrap items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act({ action: "setTotalBudget", total: Number(value) })) setEditing(false);
            }}
          >
            <label htmlFor="total-budget" className="sr-only">
              Total budget bulanan
            </label>
            <div className="relative min-w-44 flex-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <input
                id="total-budget"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                required
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={cn(fieldClass, "pl-9")}
              />
            </div>
            <Button type="submit" size="xl" disabled={busy}>
              Simpan
            </Button>
            <Button type="button" size="xl" variant="ghost" onClick={() => setEditing(false)}>
              Batal
            </Button>
            <p className="basis-full text-xs text-muted-foreground">
              Selisihnya masuk atau keluar dari kategori Keinginan.
            </p>
          </form>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex justify-between text-sm">
            <span>Budget terpakai</span>
            <span className="tabular-nums">{spentPct}%</span>
          </div>
          <Meter label="Budget terpakai" pct={totals.pct} tone={toneFor(totals.pct)} />
        </div>
        <div>
          <div className="mb-1.5 flex justify-between text-sm">
            <span>Hari berjalan</span>
            <span className="tabular-nums">
              {period.dayIndex} dari {period.days}
            </span>
          </div>
          <Meter label="Hari berjalan" pct={period.dayIndex / period.days} tone="muted" />
        </div>
        <p className="text-xs text-muted-foreground">
          Periode {shortDate(period.start)} sampai {shortDate(lastDay)}. Gajian {shortDate(period.endExclusive)},{" "}
          {period.daysLeft} hari lagi.
        </p>
      </div>
    </section>
  );
}

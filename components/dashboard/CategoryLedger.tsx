"use client";

import { useState } from "react";
import { formatIDR } from "@/lib/money";
import type { CategoryView, Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { fieldClass, groupCategories, type Act } from "./helpers";
import { Meter, toneOfStatus } from "./Meter";

const STATUS: Partial<Record<CategoryView["status"], { text: string; className: string }>> = {
  waspada: { text: "Hampir habis", className: "text-warn" },
  habis: { text: "Budget habis", className: "text-warn" },
  over: { text: "Melebihi budget", className: "text-danger" },
  kosong: { text: "Budget belum diatur", className: "text-muted-foreground" },
};

export function CategoryLedger({ snap, act, busy }: { snap: Snapshot; act: Act; busy: boolean }) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const nameOf = (id?: string) => snap.categories.find((c) => c.id === id)?.name;

  return (
    <section aria-labelledby="ledger-title">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="ledger-title" className="text-lg">
          Sisa per kategori
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
          {editing ? "Selesai" : "Ubah budget"}
        </Button>
      </div>

      <div className="mt-2 space-y-7">
        {groupCategories(snap.categories).map(({ group, items }) => {
          const remaining = items.reduce((sum, c) => sum + c.remaining, 0);
          return (
            <div key={group}>
              <div className="flex items-baseline justify-between gap-4 border-b border-foreground/20 pb-1.5">
                <h3 className="text-base">{group}</h3>
                <p className="text-sm text-muted-foreground tabular-nums">sisa {formatIDR(remaining)}</p>
              </div>
              <ul>
                {items.map((c) => {
                  const draft = drafts[c.id] ?? String(c.budget);
                  const status = STATUS[c.status];
                  return (
                    <li key={c.id} className="border-b border-border py-3">
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium">{c.name}</p>
                          <p className="text-sm text-muted-foreground tabular-nums">
                            {formatIDR(c.spent)} terpakai
                            {status && <span className={cn("ml-2 font-medium", status.className)}>{status.text}</span>}
                          </p>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <p className={cn("font-semibold", c.remaining < 0 && "text-danger")}>
                            {formatIDR(c.remaining)}
                          </p>
                          <p className="text-sm text-muted-foreground">dari {formatIDR(c.budget)}</p>
                        </div>
                      </div>
                      <Meter label={`${c.name} terpakai`} pct={c.pct} tone={toneOfStatus(c.status)} className="mt-2 h-1.5" />

                      {c.dailyCap && (
                        <p className="mt-1.5 text-sm text-muted-foreground tabular-nums">
                          Hari ini {formatIDR(c.todaySpent)} dari limit {formatIDR(c.dailyCap)}. Kelebihannya masuk{" "}
                          {nameOf(c.overflowTo) ?? "kategori lain"}.
                        </p>
                      )}
                      {c.autoDaily?.enabled && (
                        <p className="mt-1.5 text-sm text-muted-foreground tabular-nums">
                          Terpotong otomatis {formatIDR(c.autoDaily.amount)} tiap{" "}
                          {c.autoDaily.weekdaysOnly ? "hari kerja" : "hari"}.
                        </p>
                      )}

                      {editing && (
                        <form
                          className="mt-2 flex items-center gap-2"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            await act({ action: "setCategoryBudget", id: c.id, budget: Number(draft) });
                          }}
                        >
                          <label htmlFor={`b-${c.id}`} className="sr-only">
                            Budget {c.name}
                          </label>
                          <input
                            id={`b-${c.id}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            required
                            value={draft}
                            onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                            className={cn(fieldClass, "max-w-44")}
                          />
                          <Button type="submit" size="lg" variant="secondary" disabled={busy || draft === String(c.budget)}>
                            Simpan
                          </Button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

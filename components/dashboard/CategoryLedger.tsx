"use client";

import { useState } from "react";
import { formatIDR } from "@/lib/money";
import type { CategoryView, Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { fieldClass, groupCategories, type Act } from "./helpers";
import { Ring } from "./Ring";

const STATUS: Record<
  CategoryView["status"],
  { text: string; tag: string; tone: "ok" | "warn" | "danger" | "muted" }
> = {
  aman: { text: "Aman", tag: "bg-ok-tint text-ok-ink", tone: "ok" },
  waspada: {
    text: "Hampir habis",
    tag: "bg-warn-tint text-warn-ink",
    tone: "warn",
  },
  habis: { text: "Habis", tag: "bg-warn-tint text-warn-ink", tone: "warn" },
  over: {
    text: "Melebihi budget",
    tag: "bg-danger-tint text-danger-ink",
    tone: "danger",
  },
  kosong: {
    text: "Belum diatur",
    tag: "bg-muted text-muted-foreground",
    tone: "muted",
  },
};

export function CategoryLedger({
  snap,
  act,
  busy,
}: {
  snap: Snapshot;
  act: Act;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const nameOf = (id?: string) =>
    snap.categories.find((c) => c.id === id)?.name;

  return (
    <section aria-labelledby="ledger-title">
      <div className="flex items-center justify-between gap-4">
        <h2 id="ledger-title" className="text-xl">
          Sisa per kategori
        </h2>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => setEditing((v) => !v)}>
          {editing ? "Selesai" : "Ubah budget"}
        </Button>
      </div>

      <div className="mt-4 space-y-6">
        {groupCategories(snap.categories).map(({ group, items }) => {
          const remaining = items.reduce((sum, c) => sum + c.remaining, 0);
          return (
            <div key={group}>
              <div className="flex items-baseline justify-between gap-4 px-1">
                <h3 className="text-base">{group}</h3>
                <p className="text-sm text-muted-foreground tabular-nums">
                  sisa {formatIDR(remaining)}
                </p>
              </div>
              <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                {items.map((c) => {
                  const draft = drafts[c.id] ?? String(c.budget);
                  const status = STATUS[c.status];
                  return (
                    <li
                      key={c.id}
                      className="rounded-[18px] border border-border bg-card p-4">
                      <div className="flex items-center gap-3">
                        <Ring
                          label={`${c.name} terpakai`}
                          pct={c.pct}
                          tone={status.tone}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="leading-snug font-semibold">{c.name}</p>
                          <span
                            className={cn(
                              "mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                              status.tag,
                            )}>
                            {status.text}
                          </span>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <p
                            className={cn(
                              "font-bold",
                              c.remaining < 0 && "text-danger",
                            )}>
                            {formatIDR(c.remaining)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            dari {formatIDR(c.budget)}
                          </p>
                        </div>
                      </div>

                      {c.dailyCap && (
                        <p className="mt-3 text-sm text-muted-foreground tabular-nums">
                          Hari ini {formatIDR(c.todaySpent)} dari limit{" "}
                          {formatIDR(c.dailyCap)}. Kelebihannya masuk{" "}
                          {nameOf(c.overflowTo) ?? "kategori lain"}.
                        </p>
                      )}
                      {c.autoDaily?.enabled && (
                        <p className="mt-3 text-sm text-muted-foreground tabular-nums">
                          Terpotong otomatis {formatIDR(c.autoDaily.amount)}{" "}
                          tiap{" "}
                          {c.autoDaily.weekdaysOnly ? "hari kerja" : "hari"}.
                        </p>
                      )}

                      {editing && (
                        <form
                          className="mt-3 flex items-center gap-2"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            await act({
                              action: "setCategoryBudget",
                              id: c.id,
                              budget: Number(draft),
                            });
                          }}>
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
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [c.id]: e.target.value,
                              }))
                            }
                            className={cn(fieldClass, "min-w-0 flex-1")}
                          />
                          <Button
                            type="submit"
                            size="lg"
                            variant="secondary"
                            disabled={busy || draft === String(c.budget)}>
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

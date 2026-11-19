"use client";

import { useState } from "react";
import { formatIDR } from "@/lib/money";
import type { Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CategorySelect } from "./CategorySelect";
import { fieldClass, type Act } from "./helpers";

export function ExpenseForm({
  snap,
  act,
  busy,
}: {
  snap: Snapshot;
  act: Act;
  busy: boolean;
}) {
  const [date, setDate] = useState(snap.today);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const category = snap.categories.find((c) => c.id === categoryId);
  const inPeriod = date >= snap.period.start && date < snap.period.endExclusive;

  // Petunjuk limit harian (mis. Makan & Minum maksimal Rp50.000 per hari)
  let hint: { text: string; over: boolean } | null = null;
  if (category?.dailyCap && inPeriod) {
    const used = snap.transactions
      .filter((t) => t.categoryId === category.id && t.date === date)
      .reduce((sum, t) => sum + t.amount, 0);
    const remaining = Math.max(category.dailyCap - used, 0);
    const typed = Number(amount) || 0;
    const target = snap.categories.find(
      (c) => c.id === category.overflowTo,
    )?.name;
    hint =
      typed > remaining && target
        ? {
            text: `Melebihi limit harian. ${formatIDR(typed - remaining)} akan dicatat ke ${target}.`,
            over: true,
          }
        : {
            text: `Sisa limit harian ${formatIDR(remaining)} dari ${formatIDR(category.dailyCap)}.`,
            over: false,
          };
  }

  return (
    <section
      aria-labelledby="form-title"
      className="rounded-[20px] border border-border bg-card p-5">
      <h2 id="form-title" className="text-lg">
        Catat pengeluaran
      </h2>
      <form
        className="mt-3 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await act({
            action: "addExpense",
            date,
            categoryId,
            amount: Number(amount),
            note,
          });
          if (ok) {
            setAmount("");
            setNote("");
          }
        }}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="f-date"
              className="mb-1 block text-sm text-muted-foreground">
              Tanggal
            </label>
            <input
              id="f-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label
              htmlFor="f-amount"
              className="mb-1 block text-sm text-muted-foreground">
              Jumlah
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <input
                id="f-amount"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cn(fieldClass, "pl-9")}
              />
            </div>
          </div>
        </div>
        <div>
          <label
            htmlFor="f-category"
            className="mb-1 block text-sm text-muted-foreground">
            Kategori
          </label>
          <CategorySelect
            id="f-category"
            required
            categories={snap.categories}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          />
          {hint && (
            <p
              className={cn(
                "mt-1.5 text-sm",
                hint.over ? "font-medium text-danger" : "text-muted-foreground",
              )}>
              {hint.text}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="f-note"
            className="mb-1 block text-sm text-muted-foreground">
            Keterangan
          </label>
          <input
            id="f-note"
            type="text"
            maxLength={120}
            placeholder="Misalnya makan siang kantor"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={fieldClass}
          />
        </div>
        <Button type="submit" size="xl" className="w-full" disabled={busy}>
          Catat pengeluaran
        </Button>
      </form>
    </section>
  );
}

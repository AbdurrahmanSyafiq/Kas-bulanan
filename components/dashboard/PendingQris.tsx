"use client";

import { useState } from "react";
import { shortDate, timeJakarta } from "@/lib/dates";
import { formatIDR } from "@/lib/money";
import type { Category, Snapshot, Tx } from "@/lib/types";
import { CategorySelect } from "./CategorySelect";
import { DeleteButton } from "./DeleteButton";
import type { Act } from "./helpers";
import { SplitEditor } from "./SplitEditor";

/** Transaksi QRIS dari email yang menunggu kamu pilihkan kategorinya. Belum dihitung ke budget. */
export function PendingQris({
  snap,
  act,
  busy,
}: {
  snap: Snapshot;
  act: Act;
  busy: boolean;
}) {
  const { pending, categories } = snap;
  if (pending.length === 0) return null;

  const total = pending.reduce((sum, t) => sum + t.amount, 0);

  return (
    <section
      aria-labelledby="pending-title"
      className="rounded-2xl border border-pending-border bg-pending p-4 text-pending-foreground sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="pending-title" className="text-lg">
          Menunggu kategori
        </h2>
        <p className="text-sm tabular-nums">
          {pending.length} transaksi, {formatIDR(total)}
        </p>
      </div>
      <p className="mt-1 text-sm opacity-80">
        Baru dihitung ke budget setelah kamu memilih kategorinya.
      </p>

      <ul className="mt-3 divide-y divide-pending-border/60">
        {pending.map((t) => (
          <PendingItem
            key={t.id}
            t={t}
            categories={categories}
            act={act}
            busy={busy}
          />
        ))}
      </ul>
    </section>
  );
}

function PendingItem({
  t,
  categories,
  act,
  busy,
}: {
  t: Tx;
  categories: Category[];
  act: Act;
  busy: boolean;
}) {
  const [splitting, setSplitting] = useState(false);
  const name = t.merchant ?? t.note;
  return (
    <li className="grid items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_14rem_auto]">
      <div className="min-w-0">
        <p className="truncate font-semibold">{name}</p>
        <p className="truncate text-sm opacity-80">
          {shortDate(t.date)}
          {t.paidAt ? `, ${timeJakarta(t.paidAt)}` : ""}
          {t.location ? `, ${t.location}` : ""}
        </p>
      </div>
      <p className="font-semibold tabular-nums sm:text-right">
        {formatIDR(t.amount)}
      </p>
      <div className="space-y-1">
        <CategorySelect
          aria-label={`Kategori untuk ${name}`}
          categories={categories}
          value=""
          disabled={busy}
          onChange={(e) => {
            if (e.target.value)
              void act({
                action: "categorize",
                id: t.id,
                categoryId: e.target.value,
              });
          }}
        />
        {t.kind === "ewallet" && !splitting && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setSplitting(true)}
            className="text-sm font-medium underline underline-offset-2 disabled:opacity-60">
            Pecah ke beberapa kategori
          </button>
        )}
      </div>
      <div className="justify-self-end">
        <DeleteButton
          label={`Hapus transaksi ${name}`}
          disabled={busy}
          onConfirm={() => void act({ action: "deleteTx", id: t.id })}
        />
      </div>
      {splitting && (
        <SplitEditor
          tx={t}
          categories={categories}
          act={act}
          busy={busy}
          onClose={() => setSplitting(false)}
        />
      )}
    </li>
  );
}

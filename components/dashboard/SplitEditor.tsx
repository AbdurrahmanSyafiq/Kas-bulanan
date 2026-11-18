"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { formatIDR } from "@/lib/money";
import type { Category, Tx } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CategorySelect } from "./CategorySelect";
import { fieldClass, type Act } from "./helpers";

type Row = { key: number; categoryId: string; amount: string };

/** Bagi satu pembelian saldo e-wallet ke beberapa kategori. Total pecahan harus sama dengan nominalnya. */
export function SplitEditor({
  tx,
  categories,
  act,
  busy,
  onClose,
}: {
  tx: Tx;
  categories: Category[];
  act: Act;
  busy: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([
    { key: 1, categoryId: "", amount: "" },
    { key: 2, categoryId: "", amount: "" },
  ]);
  const [nextKey, setNextKey] = useState(3);

  const sum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const left = tx.amount - sum;
  const complete = rows.every(
    (r) =>
      r.categoryId &&
      Number(r.amount) > 0 &&
      Number.isInteger(Number(r.amount)),
  );
  const canSave = complete && left === 0 && !busy;

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="rounded-xl border border-pending-border bg-card p-3 text-foreground sm:col-span-full sm:p-4">
      <p className="text-sm font-semibold">
        Pecah {formatIDR(tx.amount)} ke beberapa kategori
      </p>

      <ul className="mt-3 space-y-2">
        {rows.map((r, i) => (
          <li
            key={r.key}
            className="grid grid-cols-[minmax(0,1fr)_9rem_auto] items-center gap-2">
            <CategorySelect
              aria-label={`Kategori pecahan ${i + 1}`}
              categories={categories}
              value={r.categoryId}
              disabled={busy}
              onChange={(e) => update(r.key, { categoryId: e.target.value })}
            />
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <input
                aria-label={`Jumlah pecahan ${i + 1}`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                placeholder="0"
                value={r.amount}
                disabled={busy}
                onChange={(e) => update(r.key, { amount: e.target.value })}
                className={cn(fieldClass, "pl-9")}
              />
            </div>
            <div className="flex items-center gap-1">
              {left > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    update(r.key, {
                      amount: String((Number(r.amount) || 0) + left),
                    })
                  }>
                  Isi sisa
                </Button>
              )}
              {rows.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Hapus baris ${i + 1}`}
                  disabled={busy}
                  onClick={() =>
                    setRows((rs) => rs.filter((x) => x.key !== r.key))
                  }>
                  <X />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setRows((rs) => [
              ...rs,
              { key: nextKey, categoryId: "", amount: "" },
            ]);
            setNextKey((k) => k + 1);
          }}>
          <Plus /> Tambah baris
        </Button>
        <p
          role="status"
          className={cn(
            "text-sm tabular-nums",
            left === 0
              ? "font-medium text-ok"
              : left < 0
                ? "font-medium text-danger"
                : "text-muted-foreground",
          )}>
          {left === 0
            ? "Pas, siap disimpan"
            : left > 0
              ? `Belum dibagi ${formatIDR(left)}`
              : `Kelebihan ${formatIDR(-left)}`}
        </p>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={busy}
          onClick={onClose}>
          Batal
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={!canSave}
          onClick={() =>
            void act({
              action: "split",
              id: tx.id,
              parts: rows.map((r) => ({
                categoryId: r.categoryId,
                amount: Number(r.amount),
              })),
            })
          }>
          Simpan pecahan
        </Button>
      </div>
    </div>
  );
}

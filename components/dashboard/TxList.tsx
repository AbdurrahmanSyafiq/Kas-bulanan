"use client";

import { shortDate } from "@/lib/dates";
import { formatIDR } from "@/lib/money";
import type { Snapshot } from "@/lib/types";
import { DeleteButton } from "./DeleteButton";
import type { Act } from "./helpers";

const LIMIT = 30;

export function TxList({
  snap,
  act,
  busy,
}: {
  snap: Snapshot;
  act: Act;
  busy: boolean;
}) {
  const rows = snap.transactions.slice(0, LIMIT);
  const nameOf = (id: string | null) =>
    snap.categories.find((c) => c.id === id)?.name ?? "Tanpa kategori";

  return (
    <section
      aria-labelledby="tx-title"
      className="rounded-[20px] border border-border bg-card p-5">
      <h2 id="tx-title" className="text-lg">
        Transaksi periode ini
      </h2>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Belum ada pengeluaran. Catat lewat formulir di atas, atau tunggu email
          QRIS masuk.
        </p>
      ) : (
        <ul className="mt-2">
          {rows.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 border-b border-border py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{nameOf(t.categoryId)}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {shortDate(t.date)}
                  {t.note ? `, ${t.note}` : ""}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {formatIDR(t.amount)}
              </p>
              <DeleteButton
                label={`Hapus transaksi ${nameOf(t.categoryId)} ${formatIDR(t.amount)}`}
                disabled={busy}
                onConfirm={() => void act({ action: "deleteTx", id: t.id })}
              />
            </li>
          ))}
        </ul>
      )}
      {snap.transactions.length > LIMIT && (
        <p className="mt-2 text-sm text-muted-foreground">
          Menampilkan {LIMIT} terbaru dari {snap.transactions.length} transaksi.
        </p>
      )}
    </section>
  );
}

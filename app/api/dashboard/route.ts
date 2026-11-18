import { NextResponse } from "next/server";
import {
  addExpense,
  categorizePending,
  deleteTransaction,
  setCategoryBudget,
  setTotalBudget,
  splitPending,
  UserError,
} from "@/lib/finance";
import { isValidDate } from "@/lib/dates";
import { formatIDR } from "@/lib/money";
import { mutate, readSnapshot } from "@/lib/service";
import type { Action, ApiResult, DB, Tx } from "@/lib/types";

function fail(err: unknown) {
  if (err instanceof UserError)
    return NextResponse.json({ error: err.message }, { status: 400 });
  console.error(err);
  const message =
    err instanceof Error ? err.message : "Terjadi kesalahan di server.";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Kalimat konfirmasi; menyebut kelebihan limit harian kalau ada yang dipindah. */
function noticeFor(db: DB, created: Tx[]): string {
  const over = created.find((t) => t.source === "overflow");
  if (!over) return "Tercatat.";
  const target =
    db.categories.find((c) => c.id === over.categoryId)?.name ??
    "kategori lain";
  return `Tercatat. ${formatIDR(over.amount)} melebihi limit harian, dipindah ke ${target}.`;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function GET() {
  try {
    const snapshot = await readSnapshot();
    return NextResponse.json({ snapshot } satisfies ApiResult);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  let body: Partial<Action> & Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Permintaan tidak valid." },
      { status: 400 },
    );
  }

  try {
    const { result: notice, snapshot } = await mutate(
      (db): string | undefined => {
        switch (body.action) {
          case "addExpense": {
            const date = body.date;
            if (!isValidDate(date)) throw new UserError("Tanggal tidak valid.");
            const created = addExpense(db, {
              date,
              amount: Number(body.amount),
              categoryId: str(body.categoryId),
              note: str(body.note).trim().slice(0, 120),
              source: "manual",
            });
            return noticeFor(db, created);
          }
          case "categorize": {
            const created = categorizePending(
              db,
              str(body.id),
              str(body.categoryId),
            );
            return noticeFor(db, created);
          }
          case "split": {
            const raw = Array.isArray(body.parts) ? body.parts : [];
            const parts = raw.map((p: unknown) => {
              const o = (p ?? {}) as Record<string, unknown>;
              return {
                categoryId: str(o.categoryId),
                amount: Number(o.amount),
              };
            });
            splitPending(db, str(body.id), parts);
            return `Dipecah ke ${parts.length} kategori.`;
          }
          case "deleteTx":
            deleteTransaction(db, str(body.id));
            return "Dihapus.";
          case "setCategoryBudget":
            setCategoryBudget(db, str(body.id), Number(body.budget));
            return "Budget disimpan.";
          case "setTotalBudget":
            setTotalBudget(db, Number(body.total));
            return "Total budget disimpan. Selisihnya masuk ke Keinginan.";
          default:
            throw new UserError("Aksi tidak dikenal.");
        }
      },
    );
    return NextResponse.json({ snapshot, notice } satisfies ApiResult);
  } catch (err) {
    return fail(err);
  }
}

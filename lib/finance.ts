import { addDays, dateJakarta, isWeekend, periodOf } from "./dates";
import { formatIDR } from "./money";
import { resolveNotify } from "./notify";
import type {
  Category,
  CategoryStatus,
  CategoryView,
  DailyPoint,
  DB,
  Snapshot,
  Tx,
  TxSource,
} from "./types";

/** Selisih total budget selalu masuk/keluar dari kategori ini. */
export const ADJUST_CATEGORY_ID = "keinginan";

export class UserError extends Error {}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}

function findCategory(db: DB, id: string): Category {
  const cat = db.categories.find((c) => c.id === id);
  if (!cat) throw new UserError("Kategori tidak ditemukan.");
  return cat;
}

/** Total yang sudah dipakai satu kategori pada satu tanggal. */
export function usageOnDate(db: DB, categoryId: string, date: string): number {
  let sum = 0;
  for (const t of db.transactions) {
    if (t.categoryId === categoryId && t.date === date) sum += t.amount;
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Pengeluaran
// ---------------------------------------------------------------------------

type NewExpense = {
  date: string;
  amount: number;
  categoryId: string;
  note?: string;
  source: TxSource;
  /** Dipakai kalau transaksinya berasal dari transaksi lain (mis. QRIS yang baru dikategorikan). */
  id?: string;
  extra?: Partial<
    Pick<Tx, "merchant" | "location" | "transactionNo" | "messageId" | "paidAt">
  >;
};

/**
 * Mencatat pengeluaran. Kalau kategorinya punya limit harian, bagian yang
 * melewati limit otomatis dicatat ke kategori tujuan (Keinginan).
 * Mengembalikan transaksi yang dibuat (satu, atau dua kalau ada kelebihan).
 */
export function addExpense(db: DB, e: NewExpense): Tx[] {
  const cat = findCategory(db, e.categoryId);
  if (!Number.isInteger(e.amount) || e.amount <= 0) {
    throw new UserError("Jumlah harus lebih dari 0.");
  }

  let main = e.amount;
  let over = 0;
  const overflowTo = cat.overflowTo
    ? db.categories.find((c) => c.id === cat.overflowTo)
    : undefined;
  if (cat.dailyCap && overflowTo) {
    const remaining = Math.max(
      cat.dailyCap - usageOnDate(db, cat.id, e.date),
      0,
    );
    main = Math.min(e.amount, remaining);
    over = e.amount - main;
  }

  const created: Tx[] = [];
  if (main > 0) {
    created.push({
      ...e.extra,
      id: e.id ?? newId("tx"),
      date: e.date,
      amount: main,
      categoryId: cat.id,
      note: e.note ?? "",
      source: e.source,
    });
  }
  if (over > 0 && overflowTo) {
    created.push({
      ...e.extra,
      id: main > 0 ? newId("ov") : (e.id ?? newId("ov")),
      date: e.date,
      amount: over,
      categoryId: overflowTo.id,
      note: e.note
        ? `Kelebihan ${cat.name} (${e.note})`
        : `Kelebihan ${cat.name}`,
      source: "overflow",
    });
  }
  db.transactions.push(...created);
  return created;
}

export function deleteTransaction(db: DB, id: string): void {
  const i = db.transactions.findIndex((t) => t.id === id);
  if (i < 0) throw new UserError("Transaksi tidak ditemukan.");
  db.transactions.splice(i, 1);
}

// ---------------------------------------------------------------------------
// QRIS dari email
// ---------------------------------------------------------------------------

export type QrisInput = {
  messageId: string;
  amount: number;
  merchant: string;
  location?: string | null;
  transactionNo?: string | null;
  paidAt: string;
  kind?: "ewallet";
};

/** Menyimpan transaksi QRIS sebagai "menunggu kategori". Email yang sama tidak dicatat dua kali. */
export function addQris(db: DB, input: QrisInput): { duplicate: boolean } {
  const duplicate = db.transactions.some(
    (t) =>
      t.messageId === input.messageId ||
      (!!input.transactionNo && t.transactionNo === input.transactionNo),
  );
  if (duplicate) return { duplicate: true };

  db.transactions.push({
    id: `qris-${input.messageId}`,
    date: dateJakarta(input.paidAt),
    amount: input.amount,
    categoryId: null,
    note: input.merchant,
    source: "qris",
    merchant: input.merchant,
    location: input.location || undefined,
    transactionNo: input.transactionNo || undefined,
    messageId: input.messageId,
    paidAt: input.paidAt,
    ...(input.kind ? { kind: input.kind } : {}),
  });
  return { duplicate: false };
}

/** Memilih kategori untuk transaksi QRIS yang menunggu. Mulai saat itu baru dihitung ke budget. */
export function categorizePending(
  db: DB,
  id: string,
  categoryId: string,
): Tx[] {
  const i = db.transactions.findIndex(
    (t) => t.id === id && t.categoryId === null,
  );
  if (i < 0)
    throw new UserError("Transaksi tidak ditemukan atau sudah dikategorikan.");
  const [pending] = db.transactions.splice(i, 1);
  try {
    return addExpense(db, {
      id: pending.id,
      date: pending.date,
      amount: pending.amount,
      categoryId,
      note: pending.merchant ?? pending.note,
      source: "qris",
      extra: {
        merchant: pending.merchant,
        location: pending.location,
        transactionNo: pending.transactionNo,
        messageId: pending.messageId,
        paidAt: pending.paidAt,
      },
    });
  } catch (err) {
    db.transactions.splice(i, 0, pending);
    throw err;
  }
}

/**
 * Memecah transaksi saldo e-wallet yang menunggu ke beberapa kategori.
 * Jumlah semua pecahan harus sama persis dengan nominalnya. Kalau satu pecahan gagal, semuanya dibatalkan.
 */
export function splitPending(
  db: DB,
  id: string,
  parts: { categoryId: string; amount: number }[],
): Tx[] {
  const i = db.transactions.findIndex(
    (t) => t.id === id && t.categoryId === null,
  );
  if (i < 0)
    throw new UserError("Transaksi tidak ditemukan atau sudah dikategorikan.");
  const pending = db.transactions[i];
  if (pending.kind !== "ewallet")
    throw new UserError("Hanya pembelian saldo e-wallet yang bisa dipecah.");
  if (parts.length === 0) throw new UserError("Pilih minimal satu kategori.");

  let sum = 0;
  for (const p of parts) {
    if (!db.categories.some((c) => c.id === p.categoryId))
      throw new UserError("Pilih kategori untuk setiap baris.");
    if (!Number.isInteger(p.amount) || p.amount <= 0)
      throw new UserError("Jumlah tiap baris harus lebih dari 0.");
    sum += p.amount;
  }
  if (sum !== pending.amount) {
    throw new UserError(
      `Total pecahan ${formatIDR(sum)} harus sama dengan ${formatIDR(pending.amount)}.`,
    );
  }

  const backup = db.transactions.slice();
  db.transactions.splice(i, 1);
  const created: Tx[] = [];
  try {
    parts.forEach((p, n) => {
      created.push(
        ...addExpense(db, {
          id: `${pending.id}-${n + 1}`,
          date: pending.date,
          amount: p.amount,
          categoryId: p.categoryId,
          note: pending.merchant ?? pending.note,
          source: "qris",
          extra: {
            merchant: pending.merchant,
            transactionNo: pending.transactionNo,
            messageId: pending.messageId,
            paidAt: pending.paidAt,
          },
        }),
      );
    });
  } catch (err) {
    db.transactions = backup;
    throw err;
  }
  return created;
}

// ---------------------------------------------------------------------------
// Potongan otomatis harian
// ---------------------------------------------------------------------------

/**
 * Menyusul potongan harian yang belum tercatat sejak terakhir dibuka (hanya di periode berjalan).
 * Aman dipanggil berulang. Mengembalikan true kalau ada yang berubah.
 */
export function runAutoDaily(db: DB, today: string): boolean {
  const period = periodOf(today);
  let changed = false;

  for (const cat of db.categories) {
    const auto = cat.autoDaily;
    if (!auto?.enabled) continue;

    let from = addDays(auto.lastDate, 1);
    if (from < period.start) from = period.start;

    for (let d = from; d <= today; d = addDays(d, 1)) {
      if (auto.weekdaysOnly && isWeekend(d)) continue;
      const id = `auto-${cat.id}-${d}`;
      if (db.transactions.some((t) => t.id === id)) continue;
      db.transactions.push({
        id,
        date: d,
        amount: auto.amount,
        categoryId: cat.id,
        note: "Ongkos harian (otomatis)",
        source: "auto",
      });
      changed = true;
    }

    if (auto.lastDate < today) {
      auto.lastDate = today;
      changed = true;
    }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export function totalBudget(db: DB): number {
  return db.categories.reduce((sum, c) => sum + c.budget, 0);
}

export function setCategoryBudget(db: DB, id: string, budget: number): void {
  if (!Number.isInteger(budget) || budget < 0)
    throw new UserError("Isi budget dengan angka 0 atau lebih.");
  findCategory(db, id).budget = budget;
}

/** Mengubah total budget. Selisihnya diambil dari / ditambahkan ke Keinginan. */
export function setTotalBudget(db: DB, total: number): void {
  if (!Number.isInteger(total) || total < 0)
    throw new UserError("Isi total budget dengan angka 0 atau lebih.");
  const adjust = findCategory(db, ADJUST_CATEGORY_ID);
  const next = adjust.budget + (total - totalBudget(db));
  if (next < 0) {
    throw new UserError(
      `Total sebesar itu membuat budget ${adjust.name} minus. Kecilkan budget kategori lain dulu.`,
    );
  }
  adjust.budget = next;
}

// ---------------------------------------------------------------------------
// Ringkasan untuk tampilan
// ---------------------------------------------------------------------------

function statusOf(budget: number, spent: number): CategoryStatus {
  if (budget === 0) return spent > 0 ? "over" : "kosong";
  if (spent > budget) return "over";
  if (spent === budget) return "habis";
  return spent / budget >= 0.8 ? "waspada" : "aman";
}

export function buildSnapshot(db: DB, today: string): Snapshot {
  const period = periodOf(today);
  const spentBy = new Map<string, number>();
  const spentToday = new Map<string, number>();
  const perDay = new Map<string, number>();
  const inPeriod: { tx: Tx; index: number }[] = [];
  const pending: Tx[] = [];

  db.transactions.forEach((tx, index) => {
    if (tx.categoryId === null) {
      pending.push(tx);
      return;
    }
    if (tx.date < period.start || tx.date >= period.endExclusive) return;
    spentBy.set(tx.categoryId, (spentBy.get(tx.categoryId) ?? 0) + tx.amount);
    perDay.set(tx.date, (perDay.get(tx.date) ?? 0) + tx.amount);
    if (tx.date === today)
      spentToday.set(
        tx.categoryId,
        (spentToday.get(tx.categoryId) ?? 0) + tx.amount,
      );
    inPeriod.push({ tx, index });
  });

  const categories: CategoryView[] = [...db.categories]
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const spent = spentBy.get(c.id) ?? 0;
      return {
        ...c,
        spent,
        remaining: c.budget - spent,
        pct: c.budget > 0 ? spent / c.budget : 0,
        status: statusOf(c.budget, spent),
        todaySpent: spentToday.get(c.id) ?? 0,
      };
    });

  const budget = categories.reduce((s, c) => s + c.budget, 0);
  const spent = categories.reduce((s, c) => s + c.spent, 0);

  const daily: DailyPoint[] = [];
  for (let i = 0; i < period.days; i++) {
    const date = addDays(period.start, i);
    daily.push({
      date,
      amount: perDay.get(date) ?? 0,
      future: date > today,
      weekend: isWeekend(date),
      isToday: date === today,
    });
  }

  return {
    today,
    period: {
      start: period.start,
      endExclusive: period.endExclusive,
      days: period.days,
      dayIndex: period.dayIndex,
      daysLeft: period.daysLeft,
    },
    totals: {
      budget,
      spent,
      remaining: budget - spent,
      pct: budget > 0 ? spent / budget : 0,
    },
    categories,
    notify: resolveNotify(db),
    pending: pending.sort((a, b) =>
      (b.paidAt ?? b.date).localeCompare(a.paidAt ?? a.date),
    ),
    transactions: inPeriod
      .sort((a, b) =>
        a.tx.date === b.tx.date
          ? b.index - a.index
          : b.tx.date.localeCompare(a.tx.date),
      )
      .map((x) => x.tx),
    daily,
  };
}

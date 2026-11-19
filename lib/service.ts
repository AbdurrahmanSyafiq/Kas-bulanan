import { buildSnapshot, runAutoDaily } from "./finance";
import { collectBudgetAlerts } from "./notify";
import { todayJakarta } from "./dates";
import { initialDB } from "./seed";
import { readDB, writeDB } from "./store";
import { sendTelegram, telegramReady } from "./telegram";
import type { DB, Snapshot } from "./types";

// Permintaan diproses satu per satu supaya dua perubahan yang datang bersamaan
// (mis. email QRIS masuk saat kamu mengisi form) tidak saling menimpa.
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(job: () => Promise<T>): Promise<T> {
  const result = queue.then(job, job);
  queue = result.catch(() => undefined);
  return result;
}

async function load(): Promise<{ db: DB; today: string; dirty: boolean }> {
  const today = todayJakarta();
  let db = await readDB();
  let dirty = false;
  if (!db) {
    db = initialDB();
    dirty = true;
  }
  if (runAutoDaily(db, today)) dirty = true;
  return { db, today, dirty };
}

function withEnv(snapshot: Snapshot): Snapshot {
  return { ...snapshot, telegramReady: telegramReady() };
}

/** Simpan data, lalu kirim peringatan budget (kalau ada) setelah data aman tersimpan. */
async function persist(db: DB, today: string): Promise<Snapshot> {
  const snapshot = buildSnapshot(db, today);
  const alerts = collectBudgetAlerts(db, snapshot);
  await writeDB(db);
  if (alerts.length > 0 && telegramReady())
    await sendTelegram(`Kas Bulanan\n\n${alerts.join("\n")}`);
  return withEnv(snapshot);
}

/** Membaca data (dan menyusul potongan otomatis yang tertinggal). */
export function readSnapshot(): Promise<Snapshot> {
  return serial(async () => {
    const { db, today, dirty } = await load();
    if (dirty) return persist(db, today);
    return withEnv(buildSnapshot(db, today));
  });
}

/** Mengubah data. Kalau `change` melempar error, tidak ada yang disimpan. */
export function mutate<T>(
  change: (db: DB, today: string) => T,
): Promise<{ result: T; snapshot: Snapshot }> {
  return serial(async () => {
    const { db, today } = await load();
    const result = change(db, today);
    return { result, snapshot: await persist(db, today) };
  });
}

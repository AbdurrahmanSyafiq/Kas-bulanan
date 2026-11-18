import { buildSnapshot, runAutoDaily } from "./finance";
import { todayJakarta } from "./dates";
import { initialDB } from "./seed";
import { readDB, writeDB } from "./store";
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

/** Membaca data (dan menyusul potongan otomatis yang tertinggal). */
export function readSnapshot(): Promise<Snapshot> {
  return serial(async () => {
    const { db, today, dirty } = await load();
    if (dirty) await writeDB(db);
    return buildSnapshot(db, today);
  });
}

/** Mengubah data. Kalau `change` melempar error, tidak ada yang disimpan. */
export function mutate<T>(
  change: (db: DB, today: string) => T,
): Promise<{ result: T; snapshot: Snapshot }> {
  return serial(async () => {
    const { db, today } = await load();
    const result = change(db, today);
    await writeDB(db);
    return { result, snapshot: buildSnapshot(db, today) };
  });
}

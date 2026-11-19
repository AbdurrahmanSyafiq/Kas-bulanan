import { formatIDR } from "./money";
import type { CategoryStatus, DB, NotifySettings, Snapshot } from "./types";

export const DEFAULT_NOTIFY: NotifySettings = {
  incoming: true,
  nearLimit: true,
  limitReached: true,
};

export function resolveNotify(db: DB): NotifySettings {
  return { ...DEFAULT_NOTIFY, ...(db.settings?.notify ?? {}) };
}

/** Simpan pengaturan. Hanya nilai true/false yang diterima. */
export function applyNotifySettings(
  db: DB,
  patch: Partial<Record<keyof NotifySettings, unknown>>,
): void {
  const next = resolveNotify(db);
  for (const key of Object.keys(DEFAULT_NOTIFY) as (keyof NotifySettings)[]) {
    if (typeof patch[key] === "boolean") next[key] = patch[key];
  }
  db.settings = { ...db.settings, notify: next };
}

const LEVEL: Record<CategoryStatus, number> = {
  kosong: 0,
  aman: 0,
  waspada: 1,
  habis: 2,
  over: 3,
};

/**
 * Pesan peringatan budget yang baru muncul sejak pengecekan terakhir.
 * Tiap tingkat (hampir habis, habis, melebihi) dilaporkan sekali per periode. Pengecekan pertama,
 * atau pertama di periode baru, hanya mencatat kondisi sekarang tanpa mengirim apa pun.
 */
export function collectBudgetAlerts(db: DB, snap: Snapshot): string[] {
  const settings = resolveNotify(db);
  const period = snap.period.start;
  const levels: Record<string, number> = {};
  for (const c of snap.categories) levels[c.id] = LEVEL[c.status];

  const before = db.notified;
  db.notified = { period, levels };
  if (!before || before.period !== period) return [];

  const messages: string[] = [];
  for (const c of snap.categories) {
    const now = levels[c.id];
    if (now <= (before.levels[c.id] ?? 0)) continue;
    if (now === 1 && settings.nearLimit) {
      messages.push(
        `${c.name} hampir habis: sisa ${formatIDR(c.remaining)} dari ${formatIDR(c.budget)} (${Math.round(c.pct * 100)}% terpakai).`,
      );
    } else if (now === 2 && settings.limitReached) {
      messages.push(
        `${c.name} habis: ${formatIDR(c.spent)} dari ${formatIDR(c.budget)} terpakai.`,
      );
    } else if (now === 3 && settings.limitReached) {
      messages.push(
        `${c.name} melebihi budget ${formatIDR(-c.remaining)}: ${formatIDR(c.spent)} dari ${formatIDR(c.budget)}.`,
      );
    }
  }
  return messages;
}

/** Pesan untuk QRIS atau top up e-wallet yang baru masuk dan belum punya kategori. */
export function incomingMessage(
  tx: { merchant: string; amount: number; kind?: "ewallet" },
  link?: string,
): string {
  const head =
    tx.kind === "ewallet"
      ? `${tx.merchant} ${formatIDR(tx.amount)} masuk. Pilih kategori, atau pecah ke beberapa kategori.`
      : `QRIS masuk: ${tx.merchant} ${formatIDR(tx.amount)}. Pilih kategorinya di dashboard.`;
  return link ? `${head}\n${link}` : head;
}

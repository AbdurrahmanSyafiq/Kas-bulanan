const TZ = "Asia/Jakarta";

/** Gajian jatuh tiap tanggal 10. Periode budget: tanggal 10 sampai tanggal 9 bulan berikutnya. */
export const PAYDAY = 10;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const DAYS_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const ymdFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Tanggal hari ini di Jakarta, apa pun zona waktu server. */
export function todayJakarta(now: Date = new Date()): string {
  return ymdFormat.format(now);
}

/** Tanggal Jakarta dari timestamp ISO (mis. waktu transaksi dari email). */
export function dateJakarta(iso: string): string {
  return ymdFormat.format(new Date(iso));
}

/** Jam:menit Jakarta dari timestamp ISO. */
export function timeJakarta(iso: string): string {
  return timeFormat.format(new Date(iso));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

function toUTC(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: string, n: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Selisih hari: b - a. */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

export function isWeekend(date: string): boolean {
  const dow = toUTC(date).getUTCDay();
  return dow === 0 || dow === 6;
}

export function isValidDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = parts(date);
  const t = toUTC(date);
  return t.getUTCFullYear() === y && t.getUTCMonth() + 1 === m && t.getUTCDate() === d;
}

export function periodOf(today: string) {
  const [y, m, d] = parts(today);
  let sy = y;
  let sm = m;
  if (d < PAYDAY) {
    sm -= 1;
    if (sm < 1) {
      sm = 12;
      sy -= 1;
    }
  }
  let ey = sy;
  let em = sm + 1;
  if (em > 12) {
    em = 1;
    ey += 1;
  }
  const start = ymd(sy, sm, PAYDAY);
  const endExclusive = ymd(ey, em, PAYDAY);
  return {
    start,
    endExclusive,
    days: diffDays(start, endExclusive),
    dayIndex: diffDays(start, today) + 1,
    daysLeft: diffDays(today, endExclusive),
  };
}

/** "18 Nov" */
export function shortDate(date: string): string {
  const [, m, d] = parts(date);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Rabu, 18 November 2026" */
export function longDate(date: string): string {
  const [y, m, d] = parts(date);
  return `${DAYS_LONG[toUTC(date).getUTCDay()]}, ${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

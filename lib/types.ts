// Semua uang dalam Rupiah bulat. Semua tanggal "YYYY-MM-DD" dalam zona waktu Asia/Jakarta.

export type Category = {
  id: string;
  name: string;
  group: string;
  budget: number;
  order: number;
  /** Batas pengeluaran per hari. Kelebihannya otomatis pindah ke `overflowTo`. */
  dailyCap?: number;
  /** id kategori tujuan kelebihan limit harian. */
  overflowTo?: string;
  /** Potongan otomatis tiap hari (mis. ongkos berangkat kerja). */
  autoDaily?: {
    enabled: boolean;
    amount: number;
    weekdaysOnly: boolean;
    /** Tanggal terakhir yang sudah diproses. Hari setelahnya baru dipotong. */
    lastDate: string;
  };
};

export type TxSource = "manual" | "qris" | "auto" | "overflow";

export type Tx = {
  id: string;
  date: string;
  amount: number;
  /** null = transaksi QRIS yang belum dikategorikan. */
  categoryId: string | null;
  note: string;
  source: TxSource;
  merchant?: string;
  location?: string;
  transactionNo?: string;
  messageId?: string;
  paidAt?: string;
};

export type DB = {
  categories: Category[];
  transactions: Tx[];
};

// ---- Bentuk data yang dikirim ke tampilan ----

/** habis = terpakai tepat sama dengan budget; over = sudah melewati budget. */
export type CategoryStatus = "kosong" | "aman" | "waspada" | "habis" | "over";

export type CategoryView = Category & {
  spent: number;
  remaining: number;
  pct: number;
  status: CategoryStatus;
  todaySpent: number;
};

export type DailyPoint = {
  date: string;
  amount: number;
  future: boolean;
  weekend: boolean;
  isToday: boolean;
};

export type Snapshot = {
  today: string;
  period: {
    start: string;
    endExclusive: string;
    days: number;
    /** Hari ke-berapa dalam periode (mulai dari 1). */
    dayIndex: number;
    /** Berapa hari lagi sampai gajian. */
    daysLeft: number;
  };
  totals: {
    budget: number;
    spent: number;
    remaining: number;
    pct: number;
  };
  categories: CategoryView[];
  /** Transaksi QRIS yang menunggu dikategorikan, terbaru di atas. */
  pending: Tx[];
  /** Pengeluaran periode ini yang sudah berkategori, terbaru di atas. */
  transactions: Tx[];
  daily: DailyPoint[];
};

export type Action =
  | { action: "addExpense"; date: string; categoryId: string; amount: number; note: string }
  | { action: "categorize"; id: string; categoryId: string }
  | { action: "deleteTx"; id: string }
  | { action: "setCategoryBudget"; id: string; budget: number }
  | { action: "setTotalBudget"; total: number };

export type ApiResult = { snapshot: Snapshot; notice?: string };

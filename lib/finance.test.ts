import { describe, expect, it } from "vitest";
import { periodOf } from "./dates";
import {
  addExpense,
  addQris,
  buildSnapshot,
  categorizePending,
  deleteTransaction,
  runAutoDaily,
  setTotalBudget,
  totalBudget,
  UserError,
} from "./finance";
import { seedDB } from "./seed";
import type { DB } from "./types";

// 2026-11-18 = Rabu
const TODAY = "2026-11-18";
const fresh = (): DB => seedDB(TODAY);

describe("periode gajian", () => {
  it("tanggal 10 memulai periode baru", () => {
    expect(periodOf("2026-11-10")).toMatchObject({ start: "2026-11-10", endExclusive: "2026-12-10", dayIndex: 1 });
  });
  it("tanggal 9 masih periode bulan sebelumnya", () => {
    const p = periodOf("2026-11-09");
    expect(p.start).toBe("2026-10-10");
    expect(p.endExclusive).toBe("2026-11-10");
    expect(p.daysLeft).toBe(1);
  });
  it("lintas tahun", () => {
    expect(periodOf("2027-01-05")).toMatchObject({ start: "2026-12-10", endExclusive: "2027-01-10" });
    expect(periodOf("2026-12-25")).toMatchObject({ start: "2026-12-10", endExclusive: "2027-01-10" });
  });
});

describe("data awal", () => {
  it("total budget Rp7.232.000", () => {
    expect(totalBudget(fresh())).toBe(7_232_000);
  });
  it("kuota internet sudah terpakai penuh", () => {
    const kuota = buildSnapshot(fresh(), TODAY).categories.find((c) => c.id === "kuota-internet")!;
    expect(kuota.spent).toBe(100_000);
    expect(kuota.remaining).toBe(0);
    expect(kuota.status).toBe("habis"); // pas habis bukan "melebihi"
  });
});

describe("limit makan harian", () => {
  it("di bawah limit: dicatat utuh", () => {
    const db = fresh();
    const created = addExpense(db, { date: TODAY, amount: 30_000, categoryId: "makan-minum", source: "manual" });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ categoryId: "makan-minum", amount: 30_000 });
  });

  it("melewati limit: kelebihan pindah ke Keinginan", () => {
    const db = fresh();
    addExpense(db, { date: TODAY, amount: 40_000, categoryId: "makan-minum", source: "manual" });
    const created = addExpense(db, { date: TODAY, amount: 20_000, categoryId: "makan-minum", source: "manual" });
    expect(created.map((t) => [t.categoryId, t.amount])).toEqual([
      ["makan-minum", 10_000],
      ["keinginan", 10_000],
    ]);
    expect(created[1].source).toBe("overflow");
  });

  it("limit sudah habis: seluruhnya ke Keinginan", () => {
    const db = fresh();
    addExpense(db, { date: TODAY, amount: 50_000, categoryId: "makan-minum", source: "manual" });
    const created = addExpense(db, { date: TODAY, amount: 15_000, categoryId: "makan-minum", source: "manual" });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ categoryId: "keinginan", amount: 15_000 });
  });

  it("limit dihitung per tanggal", () => {
    const db = fresh();
    addExpense(db, { date: "2026-11-17", amount: 50_000, categoryId: "makan-minum", source: "manual" });
    const created = addExpense(db, { date: TODAY, amount: 50_000, categoryId: "makan-minum", source: "manual" });
    expect(created).toHaveLength(1);
    expect(created[0].categoryId).toBe("makan-minum");
  });

  it("menolak jumlah nol atau kategori yang tidak ada", () => {
    const db = fresh();
    expect(() => addExpense(db, { date: TODAY, amount: 0, categoryId: "gas", source: "manual" })).toThrow(UserError);
    expect(() => addExpense(db, { date: TODAY, amount: 5_000, categoryId: "nope", source: "manual" })).toThrow(UserError);
  });
});

describe("potongan otomatis TransJakarta", () => {
  const trans = (db: DB) => db.transactions.filter((t) => t.categoryId === "transjakarta");

  it("hanya hari kerja, Sabtu dan Minggu dilewati", () => {
    const db = fresh();
    db.categories.find((c) => c.id === "transjakarta")!.autoDaily!.lastDate = "2026-11-12"; // Kamis
    runAutoDaily(db, "2026-11-18"); // Jumat 13, Senin 16, Selasa 17, Rabu 18
    expect(trans(db).map((t) => t.date)).toEqual(["2026-11-13", "2026-11-16", "2026-11-17", "2026-11-18"]);
    expect(trans(db).every((t) => t.amount === 10_500)).toBe(true);
  });

  it("mulai dari hari ini saat pertama dipasang, dan aman dipanggil berulang", () => {
    const db = fresh();
    expect(runAutoDaily(db, TODAY)).toBe(true);
    expect(trans(db)).toHaveLength(1);
    expect(runAutoDaily(db, TODAY)).toBe(false);
    expect(trans(db)).toHaveLength(1);
  });

  it("potongan yang dihapus tidak muncul lagi", () => {
    const db = fresh();
    runAutoDaily(db, TODAY);
    deleteTransaction(db, `auto-transjakarta-${TODAY}`);
    runAutoDaily(db, TODAY);
    expect(trans(db)).toHaveLength(0);
  });

  it("akhir pekan tidak memotong sama sekali", () => {
    const db = fresh();
    db.categories.find((c) => c.id === "transjakarta")!.autoDaily!.lastDate = "2026-11-20"; // Jumat
    runAutoDaily(db, "2026-11-22"); // Sabtu, Minggu
    expect(trans(db)).toHaveLength(0);
    runAutoDaily(db, "2026-11-23"); // Senin
    expect(trans(db).map((t) => t.date)).toEqual(["2026-11-23"]);
  });

  it("tidak menyusul potongan dari periode sebelumnya", () => {
    const db = fresh();
    db.categories.find((c) => c.id === "transjakarta")!.autoDaily!.lastDate = "2026-10-01";
    runAutoDaily(db, "2026-11-10"); // Selasa, awal periode
    expect(trans(db).map((t) => t.date)).toEqual(["2026-11-10"]);
  });
});

describe("QRIS dari email", () => {
  const qris = {
    messageId: "abc123",
    amount: 20_000,
    merchant: "WARUNG MAKAN KP MELAYU",
    location: "JAKARTA TIMUR, 13100, ID",
    transactionNo: "FT26320P25FB",
    paidAt: "2026-11-16T01:09:20.000Z", // 08:09 WIB
  };

  it("masuk sebagai menunggu kategori dan belum dihitung", () => {
    const db = fresh();
    addQris(db, qris);
    const snap = buildSnapshot(db, TODAY);
    expect(snap.pending).toHaveLength(1);
    expect(snap.pending[0]).toMatchObject({ amount: 20_000, date: "2026-11-16", categoryId: null });
    expect(snap.totals.spent).toBe(100_000); // hanya kuota internet
  });

  it("tanggal memakai zona Jakarta (lewat tengah malam UTC)", () => {
    const db = fresh();
    addQris(db, { ...qris, messageId: "late", transactionNo: "X1", paidAt: "2026-11-16T20:30:00.000Z" });
    expect(db.transactions.find((t) => t.messageId === "late")!.date).toBe("2026-11-17");
  });

  it("email yang sama tidak tercatat dua kali", () => {
    const db = fresh();
    expect(addQris(db, qris).duplicate).toBe(false);
    expect(addQris(db, qris).duplicate).toBe(true);
    expect(addQris(db, { ...qris, messageId: "lain" }).duplicate).toBe(true); // nomor transaksi sama
    expect(db.transactions.filter((t) => t.source === "qris")).toHaveLength(1);
  });

  it("setelah dikategorikan baru terhitung, dan tidak bisa dikategorikan dua kali", () => {
    const db = fresh();
    addQris(db, qris);
    categorizePending(db, "qris-abc123", "makan-minum");
    const snap = buildSnapshot(db, TODAY);
    expect(snap.pending).toHaveLength(0);
    expect(snap.categories.find((c) => c.id === "makan-minum")!.spent).toBe(20_000);
    expect(() => categorizePending(db, "qris-abc123", "gas")).toThrow(UserError);
    expect(addQris(db, qris).duplicate).toBe(true); // email lama tidak muncul lagi
  });

  it("kategori Makan & Minum tetap menghormati limit harian", () => {
    const db = fresh();
    addExpense(db, { date: "2026-11-16", amount: 40_000, categoryId: "makan-minum", source: "manual" });
    addQris(db, qris);
    categorizePending(db, "qris-abc123", "makan-minum");
    const snap = buildSnapshot(db, TODAY);
    expect(snap.categories.find((c) => c.id === "makan-minum")!.spent).toBe(50_000);
    expect(snap.categories.find((c) => c.id === "keinginan")!.spent).toBe(10_000);
  });

  it("gagal memilih kategori: transaksi tetap menunggu", () => {
    const db = fresh();
    addQris(db, qris);
    expect(() => categorizePending(db, "qris-abc123", "tidak-ada")).toThrow(UserError);
    expect(buildSnapshot(db, TODAY).pending).toHaveLength(1);
  });
});

describe("total budget", () => {
  it("selisih masuk ke Keinginan", () => {
    const db = fresh();
    setTotalBudget(db, 7_432_000);
    expect(totalBudget(db)).toBe(7_432_000);
    expect(db.categories.find((c) => c.id === "keinginan")!.budget).toBe(1_149_500);
  });
  it("menolak kalau Keinginan jadi minus, tanpa mengubah apa pun", () => {
    const db = fresh();
    expect(() => setTotalBudget(db, 6_000_000)).toThrow(UserError);
    expect(totalBudget(db)).toBe(7_232_000);
  });
});

describe("ringkasan", () => {
  it("transaksi di luar periode tidak dihitung", () => {
    const db = fresh();
    addExpense(db, { date: "2026-11-09", amount: 99_000, categoryId: "gas", source: "manual" });
    const snap = buildSnapshot(db, TODAY);
    expect(snap.categories.find((c) => c.id === "gas")!.spent).toBe(0);
    expect(snap.daily).toHaveLength(30);
    expect(snap.daily.find((d) => d.isToday)!.date).toBe(TODAY);
  });
  it("status waspada dan over", () => {
    const db = fresh();
    addExpense(db, { date: TODAY, amount: 20_000, categoryId: "gas", source: "manual" }); // 20/22 = 91%
    addExpense(db, { date: TODAY, amount: 30_000, categoryId: "air-galon", source: "manual" }); // lewat 24.000
    const cats = buildSnapshot(db, TODAY).categories;
    expect(cats.find((c) => c.id === "gas")!.status).toBe("waspada");
    expect(cats.find((c) => c.id === "air-galon")!.status).toBe("over");
    expect(cats.find((c) => c.id === "air-galon")!.remaining).toBe(-6_000);
  });
});

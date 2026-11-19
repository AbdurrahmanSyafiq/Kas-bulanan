import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { addQris } from "@/lib/finance";
import { incomingMessage, resolveNotify } from "@/lib/notify";
import { mutate } from "@/lib/service";
import { dashboardUrl, sendTelegram, telegramReady } from "@/lib/telegram";

// Dipanggil oleh Google Apps Script tiap ada email QRIS baru.
// Header wajib: x-api-key = QRIS_API_SECRET.

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : undefined;
}

export async function POST(request: Request) {
  const secret = process.env.QRIS_API_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "QRIS_API_SECRET belum diatur di server." },
      { status: 503 },
    );
  }
  if (!safeEqual(request.headers.get("x-api-key") ?? "", secret)) {
    return NextResponse.json({ error: "Kunci API salah." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body harus berupa JSON." },
      { status: 400 },
    );
  }

  const messageId = text(body.messageId, 200);
  const amount = Number(body.amount);
  const paidAt = text(body.paidAt, 40);
  if (!messageId)
    return NextResponse.json(
      { error: "messageId wajib diisi." },
      { status: 400 },
    );
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000_000_000) {
    return NextResponse.json(
      { error: "amount harus bilangan bulat positif (Rupiah)." },
      { status: 400 },
    );
  }
  if (!paidAt || Number.isNaN(Date.parse(paidAt))) {
    return NextResponse.json(
      { error: "paidAt harus berupa tanggal ISO yang valid." },
      { status: 400 },
    );
  }

  try {
    const merchant = text(body.merchant, 200) ?? "(merchant tidak terbaca)";
    const kind = body.kind === "ewallet" ? "ewallet" : undefined;
    const { result } = await mutate((db) => ({
      ...addQris(db, {
        messageId,
        amount,
        merchant,
        location: text(body.location, 200),
        transactionNo: text(body.transactionNo, 100),
        paidAt: new Date(paidAt).toISOString(),
        kind,
      }),
      notify: resolveNotify(db).incoming,
    }));
    if (!result.duplicate && result.notify && telegramReady()) {
      await sendTelegram(
        incomingMessage({ merchant, amount, kind }, dashboardUrl()),
      );
    }
    // 200 juga untuk duplikat, supaya Apps Script menganggapnya sudah terkirim.
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Gagal menyimpan transaksi." },
      { status: 500 },
    );
  }
}

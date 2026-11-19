// Kirim pesan ke Telegram. Tidak pernah melempar error: kegagalan kirim tidak boleh
// menggagalkan pencatatan transaksi. Token tidak pernah ditulis ke log.

function config() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  return token && chatId ? { token, chatId } : null;
}

export function telegramReady(): boolean {
  return config() !== null;
}

/** Alamat dashboard untuk disertakan di pesan, kalau diketahui (otomatis ada di Vercel). */
export function dashboardUrl(): string | undefined {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : undefined;
}

export async function sendTelegram(
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const cfg = config();
  if (!cfg)
    return {
      ok: false,
      error: "TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID belum diisi di server.",
    };
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${cfg.token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cfg.chatId,
          text,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        description?: string;
      } | null;
      const reason = data?.description ?? `status ${res.status}`;
      console.error(`Telegram menolak pesan: ${reason}`);
      return { ok: false, error: `Telegram menolak pesan: ${reason}` };
    }
    return { ok: true };
  } catch {
    console.error("Telegram tidak bisa dihubungi.");
    return { ok: false, error: "Tidak bisa menghubungi Telegram. Coba lagi." };
  }
}

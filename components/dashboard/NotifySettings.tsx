"use client";

import type { NotifySettings as Settings, Snapshot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import type { Act } from "./helpers";

const OPTIONS: { key: keyof Settings; title: string; hint: string }[] = [
  {
    key: "incoming",
    title: "QRIS dan top up masuk",
    hint: "Setiap transaksi baru yang menunggu kategori.",
  },
  {
    key: "nearLimit",
    title: "Kategori hampir habis",
    hint: "Sekali saat pemakaian mencapai 80%.",
  },
  {
    key: "limitReached",
    title: "Kategori habis atau melebihi budget",
    hint: "Sekali saat mencapai 100%, dan sekali lagi kalau terlewati.",
  },
];

export function NotifySettings({
  snap,
  act,
  busy,
}: {
  snap: Snapshot;
  act: Act;
  busy: boolean;
}) {
  const ready = snap.telegramReady === true;

  return (
    <section
      aria-labelledby="notify-title"
      className="rounded-[20px] border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="notify-title" className="text-lg">
            Pemberitahuan Telegram
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ready
              ? "Tersambung. Pesan dikirim ke chat Telegram-mu."
              : "Belum tersambung. Isi TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID di pengaturan server, lalu deploy ulang."}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={busy || !ready}
          onClick={() => void act({ action: "testNotify" })}>
          Kirim pesan tes
        </Button>
      </div>

      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {OPTIONS.map((o) => (
          <li key={o.key}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 has-[:checked]:border-primary/40 has-[:checked]:bg-muted/60">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-primary"
                checked={snap.notify[o.key]}
                disabled={busy}
                onChange={(e) =>
                  void act({
                    action: "setNotify",
                    settings: { [o.key]: e.target.checked },
                  })
                }
              />
              <span>
                <span className="block text-sm font-medium">{o.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {o.hint}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

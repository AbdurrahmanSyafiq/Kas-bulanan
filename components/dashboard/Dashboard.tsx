"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { longDate } from "@/lib/dates";
import type { Action, ApiResult, Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CategoryLedger } from "./CategoryLedger";
import { DailyBars } from "./DailyBars";
import { ExpenseForm } from "./ExpenseForm";
import { Hero } from "./Hero";
import { NotifySettings } from "./NotifySettings";
import { PendingQris } from "./PendingQris";
import { TxList } from "./TxList";

type Toast = { kind: "ok" | "error"; text: string };

const REFRESH_MS = 60_000;

export default function Dashboard({ initial }: { initial: Snapshot }) {
  const [snap, setSnap] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const act = useCallback(async (body: Action): Promise<boolean> => {
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as Partial<ApiResult> & {
        error?: string;
      };
      if (!res.ok || !data.snapshot)
        throw new Error(data.error ?? "Gagal menyimpan. Coba lagi.");
      setSnap(data.snapshot);
      if (data.notice) setToast({ kind: "ok", text: data.notice });
      return true;
    } catch (err) {
      setToast({
        kind: "error",
        text:
          err instanceof Error ? err.message : "Gagal menyimpan. Coba lagi.",
      });
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  // Ambil data terbaru saat tab dibuka lagi dan tiap menit, supaya QRIS baru muncul sendiri.
  useEffect(() => {
    async function refresh() {
      if (busyRef.current || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Partial<ApiResult>;
        if (data.snapshot && !busyRef.current) setSnap(data.snapshot);
      } catch {
        // koneksi putus: coba lagi di putaran berikutnya
      }
    }
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-2xl font-bold">Kas Bulanan</h1>
        <p className="text-sm text-muted-foreground">{longDate(snap.today)}</p>
      </header>

      <Hero snap={snap} act={act} busy={busy} />

      {snap.pending.length > 0 && (
        <div className="mt-8">
          <PendingQris snap={snap} act={act} busy={busy} />
        </div>
      )}

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_auto_1fr] lg:gap-x-8">
        <div className="lg:col-start-2 lg:row-start-1">
          <ExpenseForm snap={snap} act={act} busy={busy} />
        </div>
        <div className="lg:col-start-1 lg:row-span-3 lg:row-start-1">
          <CategoryLedger snap={snap} act={act} busy={busy} />
        </div>
        <div className="lg:col-start-2 lg:row-start-2">
          <DailyBars snap={snap} />
        </div>
        <div className="lg:col-start-2 lg:row-start-3">
          <TxList snap={snap} act={act} busy={busy} />
        </div>
      </div>

      <div className="mt-6">
        <NotifySettings snap={snap} act={act} busy={busy} />
      </div>

      {toast && (
        <div
          role={toast.kind === "error" ? "alert" : "status"}
          className={cn(
            "fixed inset-x-4 bottom-4 z-10 mx-auto max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg",
            toast.kind === "error"
              ? "bg-danger text-white"
              : "bg-foreground text-background",
          )}>
          {toast.text}
        </div>
      )}
    </main>
  );
}

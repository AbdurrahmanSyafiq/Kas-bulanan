import Dashboard from "@/components/dashboard/Dashboard";
import { readSnapshot } from "@/lib/service";
import type { Snapshot } from "@/lib/types";

// Selalu dibaca ulang dari penyimpanan, jangan di-cache.
export const dynamic = "force-dynamic";

export default async function Page() {
  let snapshot: Snapshot;
  try {
    snapshot = await readSnapshot();
  } catch (err) {
    console.error(err);
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-2xl">Data belum bisa dibuka</h1>
        <p className="mt-3 text-muted-foreground">
          {err instanceof Error ? err.message : "Terjadi kesalahan saat membaca data."}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Langkah pengaturannya ada di README.md, bagian &quot;Penyimpanan data&quot;.
        </p>
      </main>
    );
  }
  return <Dashboard initial={snapshot} />;
}

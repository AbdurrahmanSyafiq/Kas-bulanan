import { promises as fs } from "fs";
import path from "path";
import type { DB } from "./types";

// Penyimpanan data. Satu dokumen JSON berisi semua kategori dan transaksi.
//  - Lokal (npm run dev): file data/db.json, tanpa setup.
//  - Produksi (Vercel dll): Upstash Redis lewat REST. Set UPSTASH_REDIS_REST_URL dan
//    UPSTASH_REDIS_REST_TOKEN (nama KV_REST_API_URL / KV_REST_API_TOKEN juga dikenali).

const REDIS_KEY = "kas-bulanan:db";

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function redisCommand(cmd: unknown[]): Promise<unknown> {
  const cfg = redisConfig()!;
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Penyimpanan Redis menjawab ${res.status}.`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(`Penyimpanan Redis: ${json.error}`);
  return json.result;
}

const DATA_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

export async function readDB(): Promise<DB | null> {
  if (redisConfig()) {
    const raw = await redisCommand(["GET", REDIS_KEY]);
    return typeof raw === "string" ? (JSON.parse(raw) as DB) : null;
  }
  if (process.env.VERCEL) throw new Error(MISSING_STORAGE);
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as DB;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeDB(db: DB): Promise<void> {
  if (redisConfig()) {
    await redisCommand(["SET", REDIS_KEY, JSON.stringify(db)]);
    return;
  }
  if (process.env.VERCEL) throw new Error(MISSING_STORAGE);
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, DATA_FILE);
}

export const MISSING_STORAGE =
  "Penyimpanan data belum diatur. Di Vercel, tambahkan database Upstash Redis lalu isi UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN.";

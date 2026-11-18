import type { Action } from "@/lib/types";

/** Kirim perubahan ke server. Mengembalikan true kalau berhasil. */
export type Act = (body: Action) => Promise<boolean>;

export const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60";

/** Kelompokkan kategori menurut `group`, urutan mengikuti `order`. */
export function groupCategories<T extends { group: string; order: number }>(categories: T[]) {
  const groups = new Map<string, T[]>();
  for (const c of [...categories].sort((a, b) => a.order - b.order)) {
    const list = groups.get(c.group) ?? [];
    list.push(c);
    groups.set(c.group, list);
  }
  return [...groups].map(([group, items]) => ({ group, items }));
}

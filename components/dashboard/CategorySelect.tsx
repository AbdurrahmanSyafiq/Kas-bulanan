import type { ComponentProps } from "react";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fieldClass, groupCategories } from "./helpers";

export function CategorySelect({
  categories,
  className,
  placeholder = "Pilih kategori",
  ...props
}: { categories: Category[]; placeholder?: string } & ComponentProps<"select">) {
  return (
    <select {...props} className={cn(fieldClass, className)}>
      <option value="">{placeholder}</option>
      {groupCategories(categories).map(({ group, items }) => (
        <optgroup key={group} label={group}>
          {items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

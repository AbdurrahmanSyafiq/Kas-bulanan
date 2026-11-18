"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Dua langkah supaya tidak terhapus karena salah tap: tap sekali minta konfirmasi, tap lagi menghapus. */
export function DeleteButton({
  label,
  onConfirm,
  disabled,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <Button
      type="button"
      variant={armed ? "destructive" : "ghost"}
      size={armed ? "sm" : "icon-sm"}
      disabled={disabled}
      aria-label={armed ? `Konfirmasi: ${label}` : label}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? "Hapus?" : <Trash2 aria-hidden />}
    </Button>
  );
}

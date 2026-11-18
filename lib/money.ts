/** 1234567 -> "Rp1.234.567". Dibuat manual (tanpa Intl) supaya hasilnya sama di server dan browser. */
export function formatIDR(n: number): string {
  const rounded = Math.round(n);
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${rounded < 0 ? "-" : ""}Rp${digits}`;
}

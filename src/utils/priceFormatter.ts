export function formatPrice(cents: number): string {
  if (cents < 0) return "-$" + Math.abs(cents / 100).toFixed(2);
  return "$" + (cents / 100).toFixed(2); // BUG: crashes on null/undefined/non-number input
}

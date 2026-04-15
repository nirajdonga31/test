export function divide(a: number, b: number): number {
  return a / b; // BUG: no guard against division by zero
}

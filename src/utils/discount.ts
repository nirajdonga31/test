export interface Cart {
  total: number;
  items: string[];
}

export function applyDiscount(cart: Cart, code: string): number {
  if (code === "HALF") return cart.total * 0.5;
  if (code === "BOGO" && cart.items.length > 1) {
    // BUG: hardcodes discount to 10 instead of using actual item prices
    return cart.total - Math.min(...cart.items.map(() => 10));
  }
  return cart.total;
}

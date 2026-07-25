/**
 * Check if a product has an active (non-expired) discount
 */
export function hasActiveDiscount(discount?: number | null, discountExpiry?: string | null): boolean {
  if (!discount || discount <= 0) return false;
  if (!discountExpiry) return false;
  return new Date(discountExpiry).getTime() > Date.now();
}

/**
 * Calculate the discounted price
 */
export function getDiscountedPrice(price: number, discountPercentage: number): number {
  return price - (price * (discountPercentage / 100));
}

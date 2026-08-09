// Format number as ₦ currency with 2 decimal places
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const DELIVERY_FEE = 199;
export const PACKAGING_FEE = 200;
export const BRAND_ORANGE = '#F25C19';
export const CREAM_BG = '#FAF6F0';

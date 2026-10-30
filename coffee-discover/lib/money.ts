// Currency conversion for showing every roaster's prices in one currency.

/** Display currencies offered in settings. Store prices in any currency the rates cover still convert. */
export const CURRENCIES = [
  "USD", "CAD", "EUR", "GBP", "AUD", "NZD", "JPY", "KRW", "CNY", "TWD", "HKD", "SGD", "THB", "IDR", "MYR", "PHP", "INR",
  "AED", "SAR", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "MXN", "BRL", "COP", "ZAR",
];

export interface Rates {
  base: string;
  date: string | null;
  /** Units of each currency per 1 base unit. */
  rates: Record<string, number>;
  /** Where the rates came from, for the credit line. */
  sources?: string[];
}

/** Convert between currencies; null if either rate is unknown. */
export function convert(amount: number, from: string, to: string, rates: Rates | null): number | null {
  if (from === to) return amount;
  const f = rates?.rates[from];
  const t = rates?.rates[to];
  return f && t ? (amount / f) * t : null;
}

export interface Money {
  text: string;
  /** Set when converted: the store's own price, for a tooltip. */
  original?: string;
}

export function formatAmount(amount: number, currency: string | null, decimals?: number): string {
  const digits = decimals ?? (amount % 1 === 0 ? 0 : 2);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency ?? "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
  } catch {
    return amount.toFixed(digits);
  }
}

/**
 * Shows an amount in the visitor's chosen currency when one is set and a rate is
 * known ("≈ US$22"), otherwise in the store's own currency.
 */
export function formatMoney(amount: number | null, from: string | null, target: string | null, rates: Rates | null, decimals?: number): Money | null {
  if (amount === null) return null;
  if (!target || !from || from === target) return { text: formatAmount(amount, from ?? target, decimals) };
  const converted = convert(amount, from, target, rates);
  if (converted === null) return { text: formatAmount(amount, from, decimals) };
  // Converted prices are estimates, so round whole amounts and mark them.
  return { text: `≈ ${formatAmount(converted, target, decimals ?? (converted >= 10 ? 0 : 2))}`, original: formatAmount(amount, from, decimals) };
}

// Integer-cents money helpers — never use floats for money math

const USD_TO_INR_RATE = 83; // 1 USD ≈ 83 INR

export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function toDollars(cents: number): number {
  return Math.round(cents) / 100;
}

export function formatUSD(cents: number): string {
  return `$${toDollars(cents).toFixed(2)}`;
}

export function formatINR(cents: number): string {
  const usd = toDollars(cents);
  const inr = Math.round(usd * USD_TO_INR_RATE);
  return `₹${inr.toLocaleString("en-IN")}`;
}

export function formatCurrency(cents: number, showBoth = false): string {
  if (showBoth) {
    return `${formatINR(cents)} (${formatUSD(cents)})`;
  }
  // Default to INR
  return formatINR(cents);
}

export function usdToInr(usd: number): number {
  return Math.round(usd * USD_TO_INR_RATE);
}

export function inrToUsd(inr: number): number {
  return Math.round(inr / USD_TO_INR_RATE);
}

export function addCents(a: number, b: number): number {
  return Math.round(a) + Math.round(b);
}

export function subtractCents(a: number, b: number): number {
  return Math.round(a) - Math.round(b);
}

export function centsFromString(s: string): number {
  const parsed = parseFloat(s);
  if (isNaN(parsed)) throw new Error(`Invalid money string: "${s}"`);
  return Math.round(parsed * 100);
}

export function centsToPayPalAmount(cents: number): string {
  return toDollars(cents).toFixed(2);
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}


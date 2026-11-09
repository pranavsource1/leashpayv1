// Integer-cents money helpers — never use floats for money math

export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function toDollars(cents: number): number {
  return Math.round(cents) / 100;
}

export function formatUSD(cents: number): string {
  return `$${toDollars(cents).toFixed(2)}`;
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

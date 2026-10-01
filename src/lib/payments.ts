/**
 * Fixed-price plans. The amount paid determines how long the payment opens
 * the user, so no duration is stored in the database.
 */
export const PLANS = [
  { months: 1, price: 600 },
  { months: 3, price: 1500 },
] as const;

export type Plan = (typeof PLANS)[number];

/** How long a payment opens the user, derived from the amount they paid. */
export function monthsForAmount(amount: number): number {
  const plan = PLANS.find((p) => p.price === amount);

  return plan ? plan.months : 0;
}

/** The plan matching an amount, or null if the amount matches no plan. */
export function planForAmount(amount: number): Plan | null {
  return PLANS.find((p) => p.price === amount) ?? null;
}

/** Everything a user has paid, summed from their payments. */
export function totalPaid(amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0);
}

/**
 * When the user may next pay: the latest payment's date plus the number of
 * months its amount covers. Month overflow (e.g. Jan 31) only ever lengthens
 * the gap, never shortens it, so the floor always holds.
 */
export function nextPaymentDate(
  latest: { created_at: string; amount: number } | null | undefined,
): Date | null {
  if (!latest?.created_at) return null;

  const next = new Date(latest.created_at);
  next.setMonth(next.getMonth() + monthsForAmount(latest.amount));

  return next;
}

/** Whether the latest payment's coverage has elapsed and a new one may be recorded. */
export function isDue(next: Date | null): boolean {
  return !next || next.getTime() <= Date.now();
}

export function minGapMessage(next: Date | null, months: number): string {
  return months > 0
    ? `The current payment opens for ${months} month${months === 1 ? '' : 's'}. You can record the next payment on ${next?.toLocaleDateString()}.`
    : `You can record the next payment on ${next?.toLocaleDateString()}.`;
}

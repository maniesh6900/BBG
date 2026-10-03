/**
 * Strips common phone separators so numbers compare and store consistently,
 * e.g. "091 234-5678" -> "0912345678".
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s().-]/g, '');
}

/**
 * Validates a phone number after normalization: an optional leading "+"
 * followed by 7-15 digits, the range ITU-T E.164 allows.
 */
export function isValidPhone(raw: string): boolean {
  return /^\+?\d{7,15}$/.test(normalizePhone(raw));
}

/**
 * Phone normalization to E.164. Pure functions, deterministic.
 *
 * Accepts US/NANP formats: (313) 555-0123, 313-555-0123, +1 313 555 0123,
 * 3135550123, +13135550123. Output is always +1XXXXXXXXXX.
 *
 * Validation follows NANP structure rules: 10-digit national number, area
 * code and exchange must not start with 0 or 1, and N11 service codes
 * (911, 411, ...) are rejected. Anything else returns null.
 */

const NANP_DIGITS = 10;

function isValidNanp(digits: string): boolean {
  if (digits.length !== NANP_DIGITS) return false;
  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  // Area code and exchange: first digit 2-9, and not N11 service codes.
  if (area[0] < "2" || area[0] > "9") return false;
  if (exchange[0] < "2" || exchange[0] > "9") return false;
  if (area[1] === "1" && area[2] === "1") return false; // N11 area code
  if (exchange[1] === "1" && exchange[2] === "1") return false; // N11 exchange
  return true;
}

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === NANP_DIGITS && isValidNanp(digits)) {
    return `+1${digits}`;
  }
  if (digits.length === NANP_DIGITS + 1 && digits.startsWith("1") && isValidNanp(digits.slice(1))) {
    return `+${digits}`;
  }
  return null;
}

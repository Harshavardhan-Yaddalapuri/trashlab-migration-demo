/**
 * Date normalization rules. Pure functions, deterministic.
 *
 * Normalizes three legacy formats:
 *   - MM/DD/YYYY (US convention, 4-digit year)
 *   - YYYY-MM-DD (ISO)
 *   - DD-Mon-YY / DD-Mon-YYYY (month name disambiguates day/month order)
 *
 * Anything else is flagged ambiguous and NEVER guessed silently:
 *   - MM/DD/YY (2-digit year: century and day/month order are ambiguous)
 *   - unrecognized formats
 *
 * Calendar validity is enforced (days-in-month, leap years). Invalid dates
 * return null with ambiguous=false and a note; they are not "ambiguous",
 * they are wrong.
 */

export interface DateNormalizationResult {
  iso: string | null;
  ambiguous: boolean;
  note?: string;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Days per month for non-leap years; February is adjusted for leap years. */
const DAYS_IN_MONTH: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month - 1];
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return true;
}

function twoDigitYearToFull(year: number): number {
  if (year >= 70) return 1900 + year;
  return 2000 + year;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function isoFrom(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function normalizeDate(input: string): DateNormalizationResult {
  const value = input.trim();
  if (value === "") {
    return { iso: null, ambiguous: false, note: "empty" };
  }

  // YYYY-MM-DD (ISO)
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (match) {
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    if (!isValidCalendarDate(year, month, day)) {
      return { iso: null, ambiguous: false, note: "invalid date" };
    }
    return { iso: isoFrom(year, month, day), ambiguous: false };
  }

  // DD-Mon-YY or DD-Mon-YYYY (month name disambiguates day/month order)
  match = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/.exec(value);
  if (match) {
    const day = Number.parseInt(match[1], 10);
    const month = MONTHS[match[2].toLowerCase()];
    const yearRaw = Number.parseInt(match[3], 10);
    if (!month) {
      return { iso: null, ambiguous: false, note: "invalid month name" };
    }
    const year = match[3].length === 2 ? twoDigitYearToFull(yearRaw) : yearRaw;
    if (!isValidCalendarDate(year, month, day)) {
      return { iso: null, ambiguous: false, note: "invalid date" };
    }
    return { iso: isoFrom(year, month, day), ambiguous: false };
  }

  // MM/DD/YYYY (US convention, 4-digit year only)
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (match) {
    const month = Number.parseInt(match[1], 10);
    const day = Number.parseInt(match[2], 10);
    const year = Number.parseInt(match[3], 10);
    if (!isValidCalendarDate(year, month, day)) {
      return { iso: null, ambiguous: false, note: "invalid date" };
    }
    return { iso: isoFrom(year, month, day), ambiguous: false };
  }

  // MM/DD/YY: 2-digit year. Century and day/month order are ambiguous; never guess.
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(value);
  if (match) {
    return { iso: null, ambiguous: true, note: "ambiguous 2-digit year" };
  }

  return { iso: null, ambiguous: true, note: "unrecognized format" };
}

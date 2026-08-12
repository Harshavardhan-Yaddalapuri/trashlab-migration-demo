/**
 * Money as integer cents. Never floats.
 * All monetary values in the system are integer cents (USD).
 */

export type Cents = number;

export function centsFromString(value: string): Cents {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error("Cannot parse empty string as money");
  }
  const normalized = trimmed.replace(/[$,\s]/g, "");
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) {
    throw new Error(`Invalid money string: "${value}"`);
  }
  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number.parseInt(match[2], 10);
  const fraction = match[3] ? match[3].padEnd(2, "0") : "00";
  const cents = Number.parseInt(fraction, 10);
  return sign * (whole * 100 + cents);
}

export function centsToDisplay(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${sign}$${dollars.toLocaleString("en-US")}.${fraction}`;
}

export function addCents(a: Cents, b: Cents): Cents {
  return a + b;
}

export function multiplyCentsByRate(cents: Cents, rate: number): Cents {
  return Math.round(cents * rate);
}

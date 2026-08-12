/**
 * Container ID normalization. Pure functions, deterministic.
 *
 * Canonical form: RC-<digits> (e.g. "RC-1023").
 * Accepts: RC-1023, 1023, BIN 1023, RC 1023, CONTAINER 1023, rc-1023,
 * BIN-1023, with optional surrounding whitespace. Leading zeros are
 * stripped so "RC-01023" and "RC-1023" resolve to the same container.
 *
 * Unrecognized input is returned cleaned (trimmed, uppercased, whitespace
 * collapsed) so callers can detect and flag it; it is never silently
 * dropped or coerced.
 */

const CONTAINER_ID_PATTERN = /^(?:RC[- ]?|BIN[- ]?|CONTAINER[- ]?)?(\d{1,6})$/;

export function normalizeContainerId(input: string): string {
  const value = input.trim().replace(/\s+/g, " ").toUpperCase();
  const match = CONTAINER_ID_PATTERN.exec(value);
  if (!match) {
    return value;
  }
  const digits = match[1].replace(/^0+/, "") || "0";
  return `RC-${digits}`;
}

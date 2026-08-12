/**
 * Company name normalization. Pure functions, deterministic.
 *
 * Normalizes case, whitespace, and legal suffixes:
 *   - trims and collapses internal whitespace
 *   - title-cases the name portion
 *   - canonicalizes legal suffixes (LLC/Inc/Corp/Co/Ltd and their long
 *     forms: Incorporated, Corporation, Company, Limited)
 *
 * Examples:
 *   "summit construction llc"        -> "Summit Construction LLC"
 *   "Summit Construction, Inc."      -> "Summit Construction Inc"
 *   "  summit   construction  corp " -> "Summit Construction Corp"
 *
 * Known limitation: naive title-casing mangles names like "McDonald" or
 * "O'Brien". The seeded dataset does not contain such names; if real data
 * does, extend titleCase with an exception list.
 */

const SUFFIX_CANONICAL: Record<string, string> = {
  LLC: "LLC",
  INC: "Inc",
  INCORPORATED: "Inc",
  CORP: "Corp",
  CORPORATION: "Corp",
  CO: "Co",
  COMPANY: "Co",
  LTD: "Ltd",
  LIMITED: "Ltd",
};

function titleCaseWord(word: string): string {
  return word
    .split("-")
    .map((part) => (part === "" ? part : part[0].toUpperCase() + part.slice(1).toLowerCase()))
    .join("-");
}

function titleCase(value: string): string {
  return value.split(" ").map(titleCaseWord).join(" ");
}

export function normalizeCompanyName(input: string): string {
  const value = input.trim().replace(/\s+/g, " ");
  if (value === "") return "";

  const tokens = value.split(" ");
  const lastToken = tokens[tokens.length - 1];
  const suffixKey = lastToken.replace(/^,/, "").replace(/\./g, "").toUpperCase();
  const canonical = SUFFIX_CANONICAL[suffixKey];

  if (canonical) {
    const namePart = tokens.slice(0, -1).join(" ").replace(/[,.]+$/, "");
    const name = titleCase(namePart);
    return name === "" ? canonical : `${name} ${canonical}`;
  }

  return titleCase(value);
}

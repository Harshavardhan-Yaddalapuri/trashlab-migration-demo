/**
 * Legacy service code mapper. Pure functions, deterministic.
 *
 * "SW-COMM-2YD" -> { lineOfBusiness: "frontload", sizeYards: 2, frequency: "weekly", ... }
 *
 * Contract with the migration pipeline:
 * - Known codes map with high confidence (auto-map).
 * - Variant spellings (SW-FL-2YD, SW-COMM-2) map with slightly lower confidence.
 * - Retired codes (SW-OPEN-20YD) map to their current-model equivalent with a
 *   retired flag and review confidence, so a human confirms the migration.
 * - Unknown codes NEVER fail silently: they return a best-effort low-confidence
 *   mapping (never null for non-empty input) so the review queue resolves them
 *   with evidence instead of dropping them.
 * - The rule table is versioned (CURRENT_RULES_VERSION). Proposals carry the
 *   version that produced them, so a rule bump can re-evaluate only the
 *   records that hit the changed rule.
 */

export type LineOfBusiness = "rolloff" | "frontload" | "residential";
export type ServiceFrequency = "weekly" | "biweekly" | "monthly" | "oncall";

export interface MappedServiceCode {
  /** Null when the code carries no recognizable line-of-business signal. */
  lineOfBusiness: LineOfBusiness | null;
  /** Null when the size cannot be parsed. Container size in yards. */
  sizeYards: number | null;
  /** Null when the frequency token is missing or unrecognized. */
  frequency: ServiceFrequency | null;
  /** 0..1. Below the mapping exception threshold the proposal goes to review. */
  confidence: number;
  /** Rule-table version that produced this mapping. */
  rulesVersion: string;
  /** True when the legacy code identifies a service retired in the target model. */
  retired: boolean;
  /** Current-model equivalent code for retired services, when known. */
  retiredAs?: string;
  /** Human-readable reasons for the confidence value. Shown to reviewers. */
  notes: string[];
}

export const CURRENT_RULES_VERSION = "rules-v1";

export interface ServiceFamilyRule {
  id: string;
  version: string;
  lineOfBusiness: LineOfBusiness;
  /** Accepted legacy tokens; the first is the canonical spelling. */
  tokens: readonly string[];
  /** Container sizes offered in the target model, in yards. */
  validSizes: readonly number[];
  /** True when the canonical spelling ends with a YD suffix. */
  ydsuffixCanonical: boolean;
  /** True when an explicit frequency token is required. */
  frequencyRequired: boolean;
}

/** Versioned rule table for the SW-* service-code family. */
export const MAPPING_RULES: readonly ServiceFamilyRule[] = [
  {
    id: "family-rolloff",
    version: CURRENT_RULES_VERSION,
    lineOfBusiness: "rolloff",
    tokens: ["RO", "ROLLOFF"],
    validSizes: [10, 20, 30, 40],
    ydsuffixCanonical: true,
    frequencyRequired: false,
  },
  {
    id: "family-frontload",
    version: CURRENT_RULES_VERSION,
    lineOfBusiness: "frontload",
    tokens: ["COMM", "FL", "FRONTLOAD"],
    validSizes: [2, 4, 6, 8],
    ydsuffixCanonical: true,
    frequencyRequired: false,
  },
  {
    id: "family-residential",
    version: CURRENT_RULES_VERSION,
    lineOfBusiness: "residential",
    tokens: ["RES", "RESIDENTIAL"],
    validSizes: [1, 2],
    ydsuffixCanonical: false,
    frequencyRequired: true,
  },
];

export interface RetiredRule {
  id: string;
  version: string;
  /** Anchored regex against the normalized code. */
  pattern: RegExp;
  lineOfBusiness: LineOfBusiness;
  /** Builds the current-model equivalent code from the captured size. */
  equivalent: (sizeYards: number) => string;
  note: string;
}

/** Retired services, checked before the generic family parser. */
export const RETIRED_RULES: readonly RetiredRule[] = [
  {
    id: "retired-open-top",
    version: CURRENT_RULES_VERSION,
    pattern: /^SW-OPEN-(\d{1,2})(?:YD)?$/,
    lineOfBusiness: "rolloff",
    equivalent: (sizeYards) => `SW-RO-${sizeYards}YD`,
    note: "Open-top service is retired in the target model; migrate to the rolloff equivalent.",
  },
];

/** Confidence building blocks. Deliberate values:
 * canonical spelling, all fields valid -> 1.0 (auto-map)
 * non-canonical LOB token (SW-FL, SW-ROLLOFF, ...) -> 0.92 (still auto-maps)
 * missing YD suffix on a canonical code -> -0.1 (cosmetic, stays auto-map)
 * missing/invalid required field (size, or frequency for residential) -> -0.4
 *   (single required-field defect lands the proposal below the review threshold)
 * unknown line of business in an SW-shaped code -> 0.3 (review)
 * retired service -> 0.6 (review; human confirms the equivalent)
 * unrecognized structure, LOB inferable -> 0.45 (review)
 * unrecognized structure, no LOB signal -> 0.3 (review) */
const CONFIDENCE = {
  /** Canonical spelling, all fields valid. */
  canonical: 1,
  /** Recognized but non-canonical LOB token (SW-FL, SW-ROLLOFF, ...). */
  variantToken: 0.92,
  /** Canonical spelling missing its YD suffix. */
  missingSuffix: 0.1,
  /** Missing or invalid required field (size, frequency). */
  missingRequiredField: 0.4,
  /** Recognizable SW shape but unknown line of business. */
  unknownLob: 0.3,
  /** Retired service mapping to its current-model equivalent. */
  retired: 0.6,
  /** Unrecognized structure with an inferred line of business. */
  inferred: 0.45,
  /** Unrecognized structure with no line-of-business signal. */
  inferredNoLob: 0.3,
} as const;

const FREQUENCY_TOKENS: Readonly<Record<string, ServiceFrequency>> = {
  W: "weekly",
  WEEKLY: "weekly",
  BW: "biweekly",
  BIW: "biweekly",
  M: "monthly",
  MONTHLY: "monthly",
  OC: "oncall",
  ONCALL: "oncall",
};

/** LOB token -> family rule, built once from the versioned rule table. */
const TOKEN_TO_FAMILY: ReadonlyMap<string, ServiceFamilyRule> = new Map(
  MAPPING_RULES.flatMap((rule) => rule.tokens.map((token) => [token, rule] as const)),
);

/** Generic SW family shape: SW-<LOB>-<size>[YD][-<FREQ>]. Size and frequency optional. */
const GENERIC_PATTERN = /^SW-([A-Z]+)(?:-(\d{1,2}))?(?:YD)?(?:-([A-Z]+))?$/;

/** Best-effort LOB token scan for codes that do not match the SW shape.
 * Longest tokens first so RESIDENTIAL wins over RES, ROLLOFF over RO. */
const INFERENCE_LOB_TOKEN = /(ROLLOFF|FRONTLOAD|RESIDENTIAL|COMM|RO|FL|RES)/;
const INFERENCE_SIZE = /(\d{1,2})/;

function normalizeCode(code: string): string {
  return code.trim().replace(/\s+/g, " ").toUpperCase();
}

function roundConfidence(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}

/** Retired services: deterministic equivalent, but review confidence. */
function matchRetired(normalized: string): MappedServiceCode | null {
  for (const rule of RETIRED_RULES) {
    const match = rule.pattern.exec(normalized);
    if (match === null) {
      continue;
    }
    const sizeYards = match[1] !== undefined ? Number.parseInt(match[1], 10) : null;
    return {
      lineOfBusiness: rule.lineOfBusiness,
      sizeYards,
      frequency: "weekly",
      confidence: CONFIDENCE.retired,
      rulesVersion: rule.version,
      retired: true,
      retiredAs: sizeYards !== null ? rule.equivalent(sizeYards) : undefined,
      notes: [rule.note],
    };
  }
  return null;
}

/** Known-family parse with confidence derived from spelling and field validity. */
function parseFamilyCode(normalized: string): MappedServiceCode | null {
  const match = GENERIC_PATTERN.exec(normalized);
  if (match === null) {
    return null;
  }

  const lobToken = match[1];
  const family = TOKEN_TO_FAMILY.get(lobToken) ?? null;
  if (family === null) {
    // Recognizable SW shape but unknown line of business: low confidence, never silent.
    const sizeRaw = match[2];
    const notes = [`Unknown line-of-business token "${lobToken}".`];
    if (sizeRaw !== undefined) {
      notes.push(`Parsed size ${Number.parseInt(sizeRaw, 10)} yards, but the line of business is unknown.`);
    }
    return {
      lineOfBusiness: null,
      sizeYards: sizeRaw !== undefined ? Number.parseInt(sizeRaw, 10) : null,
      frequency: null,
      confidence: CONFIDENCE.unknownLob,
      rulesVersion: CURRENT_RULES_VERSION,
      retired: false,
      notes,
    };
  }

  const notes: string[] = [];
  const canonicalToken = family.tokens[0];
  let confidence = lobToken === canonicalToken ? CONFIDENCE.canonical : CONFIDENCE.variantToken;

  const sizeRaw = match[2];
  const sizeYards = sizeRaw !== undefined ? Number.parseInt(sizeRaw, 10) : null;
  if (sizeYards === null) {
    confidence -= CONFIDENCE.missingRequiredField;
    notes.push("Missing container size.");
  } else if (!family.validSizes.includes(sizeYards)) {
    confidence -= CONFIDENCE.missingRequiredField;
    notes.push(
      `Size ${sizeYards} yards is outside the ${family.validSizes.join("/")} yard sizes offered for ${family.lineOfBusiness}.`,
    );
  }

  const freqRaw = match[3];
  const frequency = freqRaw !== undefined ? (FREQUENCY_TOKENS[freqRaw] ?? null) : null;
  if (family.frequencyRequired) {
    if (frequency === null) {
      confidence -= CONFIDENCE.missingRequiredField;
      notes.push(
        freqRaw === undefined
          ? "Residential codes require an explicit frequency token."
          : `Unknown frequency token "${freqRaw}".`,
      );
    }
  } else if (freqRaw !== undefined && frequency === null) {
    confidence -= CONFIDENCE.missingRequiredField;
    notes.push(`Unknown frequency token "${freqRaw}".`);
  }

  // Default frequency to weekly only for complete, non-residential codes.
  // When the size is missing we cannot know the service, so do not guess.
  let resolvedFrequency = frequency;
  if (!family.frequencyRequired && sizeYards !== null && frequency === null) {
    resolvedFrequency = "weekly";
  }

  if (family.ydsuffixCanonical && lobToken === canonicalToken && freqRaw === undefined && !/-\d{1,2}YD$/.test(normalized)) {
    confidence -= CONFIDENCE.missingSuffix;
    notes.push("Missing YD suffix.");
  }

  return {
    lineOfBusiness: family.lineOfBusiness,
    sizeYards,
    frequency: resolvedFrequency,
    confidence: roundConfidence(confidence),
    rulesVersion: family.version,
    retired: false,
    notes,
  };
}

/** Unrecognized structure: best-effort partial mapping, low confidence. */
function inferCode(normalized: string): MappedServiceCode {
  const lobMatch = INFERENCE_LOB_TOKEN.exec(normalized);
  const sizeMatch = INFERENCE_SIZE.exec(normalized);
  const notes: string[] = [];
  let lineOfBusiness: LineOfBusiness | null = null;
  let confidence: number = CONFIDENCE.inferredNoLob;

  if (lobMatch !== null) {
    const family = TOKEN_TO_FAMILY.get(lobMatch[1]);
    if (family !== undefined) {
      lineOfBusiness = family.lineOfBusiness;
      confidence = CONFIDENCE.inferred;
      notes.push(`Code structure unrecognized; inferred line of business from token "${lobMatch[1]}".`);
    }
  }

  const sizeYards = sizeMatch !== null ? Number.parseInt(sizeMatch[1], 10) : null;
  if (sizeYards !== null) {
    notes.push(`Parsed size ${sizeYards} yards, unverified.`);
  }
  if (lineOfBusiness === null) {
    notes.push("No recognizable line-of-business token; manual mapping required.");
  }
  if (sizeYards === null) {
    notes.push("Missing container size.");
  }

  return {
    lineOfBusiness,
    sizeYards,
    frequency: null,
    confidence,
    rulesVersion: CURRENT_RULES_VERSION,
    retired: false,
    notes,
  };
}

/**
 * Map a legacy service code to the target data model.
 * Returns null only for empty input; every non-empty code gets a mapping,
 * with confidence deciding whether it auto-maps or goes to review.
 */
export function mapServiceCode(code: string): MappedServiceCode | null {
  const normalized = normalizeCode(code);
  if (normalized === "") {
    return null;
  }

  const retired = matchRetired(normalized);
  if (retired !== null) {
    return retired;
  }

  const parsed = parseFamilyCode(normalized);
  if (parsed !== null) {
    return parsed;
  }

  return inferCode(normalized);
}

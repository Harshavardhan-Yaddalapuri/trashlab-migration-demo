import { describe, expect, it } from "vitest";
import {
  CURRENT_RULES_VERSION,
  MAPPING_RULES,
  mapServiceCode,
  type MappedServiceCode,
} from "./code-mapper";

describe("code-mapper: known codes", () => {
  it("maps the canonical frontload code with full confidence", () => {
    const mapped = mapServiceCode("SW-COMM-2YD");
    expect(mapped).not.toBeNull();
    expect(mapped?.lineOfBusiness).toBe("frontload");
    expect(mapped?.sizeYards).toBe(2);
    expect(mapped?.frequency).toBe("weekly");
    expect(mapped?.confidence).toBe(1);
    expect(mapped?.retired).toBe(false);
    expect(mapped?.rulesVersion).toBe(CURRENT_RULES_VERSION);
  });

  it("maps rolloff codes with YD suffix and without", () => {
    const withSuffix = mapServiceCode("SW-RO-20YD");
    expect(withSuffix).not.toBeNull();
    expect(withSuffix?.lineOfBusiness).toBe("rolloff");
    expect(withSuffix?.sizeYards).toBe(20);
    expect(withSuffix?.frequency).toBe("weekly");
    expect(withSuffix?.confidence).toBe(1);

    const noSuffix = mapServiceCode("SW-RO-20");
    expect(noSuffix).not.toBeNull();
    expect(noSuffix?.lineOfBusiness).toBe("rolloff");
    expect(noSuffix?.sizeYards).toBe(20);
    expect(noSuffix?.confidence).toBe(0.9);
    expect(noSuffix?.notes.some((n) => n.includes("YD"))).toBe(true);
  });

  it("maps all rolloff and frontload sizes across their rule families", () => {
    const rolloff = MAPPING_RULES.find((r) => r.lineOfBusiness === "rolloff");
    const frontload = MAPPING_RULES.find((r) => r.lineOfBusiness === "frontload");
    for (const size of rolloff!.validSizes) {
      const mapped = mapServiceCode(`SW-RO-${size}YD`);
      expect(mapped?.lineOfBusiness).toBe("rolloff");
      expect(mapped?.sizeYards).toBe(size);
      expect(mapped?.confidence).toBe(1);
    }
    for (const size of frontload!.validSizes) {
      const mapped = mapServiceCode(`SW-COMM-${size}YD`);
      expect(mapped?.lineOfBusiness).toBe("frontload");
      expect(mapped?.sizeYards).toBe(size);
      expect(mapped?.confidence).toBe(1);
    }
  });

  it("maps explicit frequency tokens", () => {
    expect(mapServiceCode("SW-COMM-2YD-BW")?.frequency).toBe("biweekly");
    expect(mapServiceCode("SW-COMM-2YD-M")?.frequency).toBe("monthly");
    expect(mapServiceCode("SW-COMM-2YD-OC")?.frequency).toBe("oncall");
  });

  it("maps residential codes only with an explicit frequency", () => {
    const mapped = mapServiceCode("SW-RES-1-W");
    expect(mapped).not.toBeNull();
    expect(mapped?.lineOfBusiness).toBe("residential");
    expect(mapped?.sizeYards).toBe(1);
    expect(mapped?.frequency).toBe("weekly");
    expect(mapped?.confidence).toBe(1);

    // Missing required frequency token -> low confidence, not null.
    const noFreq = mapServiceCode("SW-RES-1");
    expect(noFreq).not.toBeNull();
    expect(noFreq?.lineOfBusiness).toBe("residential");
    expect(noFreq?.sizeYards).toBe(1);
    expect(noFreq?.frequency).toBeNull();
    expect(noFreq!.confidence).toBeLessThan(0.7);
  });

  it("handles case, whitespace, and surrounding noise", () => {
    expect(mapServiceCode("  sw-comm-2yd  ")?.confidence).toBe(1);
    expect(mapServiceCode("SW-COMM-2 YD")?.lineOfBusiness).toBe("frontload");
  });

  it("is deterministic for the same input", () => {
    const a = mapServiceCode("SW-COMM-2YD");
    const b = mapServiceCode("SW-COMM-2YD");
    expect(a).toEqual(b);
  });
});

describe("code-mapper: variant spellings", () => {
  it("maps non-canonical LOB tokens with slightly lower confidence", () => {
    const viaFl = mapServiceCode("SW-FL-2YD");
    expect(viaFl?.lineOfBusiness).toBe("frontload");
    expect(viaFl?.sizeYards).toBe(2);
    expect(viaFl?.frequency).toBe("weekly");
    expect(viaFl?.confidence).toBe(0.92);

    const viaFull = mapServiceCode("SW-FRONTLOAD-2YD");
    expect(viaFull?.lineOfBusiness).toBe("frontload");
    expect(viaFull?.confidence).toBe(0.92);

    const viaRolloff = mapServiceCode("SW-ROLLOFF-20YD");
    expect(viaRolloff?.lineOfBusiness).toBe("rolloff");
    expect(viaRolloff?.sizeYards).toBe(20);
    expect(viaRolloff?.confidence).toBe(0.92);
  });

  it("maps every token declared in the rule table", () => {
    for (const rule of MAPPING_RULES) {
      for (const token of rule.tokens) {
        const size = rule.validSizes[0];
        const code =
          rule.frequencyRequired && rule.lineOfBusiness === "residential"
            ? `SW-${token}-${size}-W`
            : rule.ydsuffixCanonical
              ? `SW-${token}-${size}YD`
              : `SW-${token}-${size}`;
        const mapped = mapServiceCode(code);
        expect(mapped, `token ${token}`).not.toBeNull();
        expect(mapped?.lineOfBusiness, `token ${token}`).toBe(rule.lineOfBusiness);
      }
    }
  });
});

describe("code-mapper: retired services", () => {
  it("maps retired open-top service to the rolloff equivalent with review confidence", () => {
    const mapped = mapServiceCode("SW-OPEN-20YD");
    expect(mapped).not.toBeNull();
    expect(mapped?.lineOfBusiness).toBe("rolloff");
    expect(mapped?.sizeYards).toBe(20);
    expect(mapped?.retired).toBe(true);
    expect(mapped?.retiredAs).toBe("SW-RO-20YD");
    expect(mapped?.frequency).toBe("weekly");
    expect(mapped!.confidence).toBeLessThan(0.7);
    expect(mapped?.notes.some((n) => n.toLowerCase().includes("retired"))).toBe(true);
  });
});

describe("code-mapper: unknown codes produce low-confidence mappings", () => {
  it("never returns null for a non-empty unknown code", () => {
    for (const code of ["NOPE-1", "LEGACY-CODE", "OLD-SVC-7", "SW-XX-99YD", "SW-COMM-XX"]) {
      const mapped = mapServiceCode(code);
      expect(mapped, code).not.toBeNull();
      expect(mapped!.confidence, code).toBeLessThan(0.7);
    }
  });

  it("returns low confidence for an SW-shaped code with unknown line of business", () => {
    const mapped = mapServiceCode("SW-XX-99YD");
    expect(mapped).not.toBeNull();
    expect(mapped?.lineOfBusiness).toBeNull();
    expect(mapped?.sizeYards).toBe(99);
    expect(mapped?.frequency).toBeNull();
    expect(mapped?.confidence).toBe(0.3);
    expect(mapped?.notes.some((n) => n.includes("XX"))).toBe(true);
  });

  it("returns low confidence for an SW-shaped code with no size", () => {
    const mapped = mapServiceCode("SW-COMM-XX");
    expect(mapped).not.toBeNull();
    expect(mapped?.lineOfBusiness).toBe("frontload");
    expect(mapped?.sizeYards).toBeNull();
    expect(mapped?.frequency).toBeNull();
    expect(mapped!.confidence).toBeLessThan(0.7);
    expect(mapped?.notes.some((n) => n.includes("size"))).toBe(true);
  });

  it("returns low confidence for a structurally unknown code and infers the LOB", () => {
    const mapped = mapServiceCode("OLD-SVC-7");
    expect(mapped).not.toBeNull();
    expect(mapped?.lineOfBusiness).toBeNull();
    expect(mapped?.sizeYards).toBe(7);
    expect(mapped!.confidence).toBeLessThan(0.7);
    expect(mapped?.notes.some((n) => n.includes("manual"))).toBe(true);
  });

  it("returns low confidence for a completely unrecognized code", () => {
    const mapped = mapServiceCode("BOGUS-CODE-42");
    expect(mapped).not.toBeNull();
    expect(mapped!.confidence).toBeLessThan(0.7);
  });
});

describe("code-mapper: empty and degenerate input", () => {
  it("returns null for empty and whitespace-only input", () => {
    expect(mapServiceCode("")).toBeNull();
    expect(mapServiceCode("   ")).toBeNull();
  });

  it("keeps the rules table versioned and internally consistent", () => {
    expect(CURRENT_RULES_VERSION).toBe("rules-v1");
    for (const rule of MAPPING_RULES) {
      expect(rule.version).toBe(CURRENT_RULES_VERSION);
      expect(rule.tokens.length).toBeGreaterThan(0);
      expect(rule.validSizes.length).toBeGreaterThan(0);
      expect(new Set(rule.tokens).size).toBe(rule.tokens.length);
    }
  });
});

/** Type-only guard so the test file also pins the exported shape. */
function assertMappedShape(_mapped: MappedServiceCode): void {
  void _mapped;
}
void assertMappedShape;

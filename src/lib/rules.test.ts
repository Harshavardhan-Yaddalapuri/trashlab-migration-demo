import { describe, expect, it } from "vitest";
import { centsFromString, centsToDisplay } from "@/lib/money";
import { normalizeDate } from "@/pipeline/rules/date-normalizer";
import { normalizeContainerId } from "@/pipeline/rules/id-normalizer";
import { normalizePhone } from "@/pipeline/rules/phone-normalizer";
import { customerBlockingKey } from "@/pipeline/rules/dedup-keys";
import { mapServiceCode } from "@/pipeline/rules/code-mapper";
import { computeMetrics, evalGatePasses } from "@/pipeline/eval/metrics";

describe("money", () => {
  it("parses dollars and cents into integer cents", () => {
    expect(centsFromString("$1,234.56")).toBe(123456);
    expect(centsFromString("0.99")).toBe(99);
    expect(centsFromString("42")).toBe(4200);
    expect(centsFromString("-5.50")).toBe(-550);
  });

  it("rejects invalid money strings", () => {
    expect(() => centsFromString("abc")).toThrow();
    expect(() => centsFromString("")).toThrow();
  });

  it("formats cents as display currency", () => {
    expect(centsToDisplay(123456)).toBe("$1,234.56");
    expect(centsToDisplay(5)).toBe("$0.05");
  });
});

describe("date-normalizer", () => {
  it("normalizes ISO dates", () => {
    expect(normalizeDate("2023-01-02").iso).toBe("2023-01-02");
  });

  it("normalizes MM/DD/YYYY", () => {
    expect(normalizeDate("01/02/2023").iso).toBe("2023-01-02");
  });

  it("normalizes DD-Mon-YY with 2-digit year", () => {
    expect(normalizeDate("02-Jan-23").iso).toBe("2023-01-02");
  });

  it("flags ambiguous input", () => {
    const result = normalizeDate("not-a-date");
    expect(result.iso).toBeNull();
    expect(result.ambiguous).toBe(true);
  });
});

describe("id-normalizer", () => {
  it("canonicalizes container ids", () => {
    expect(normalizeContainerId("RC-1023")).toBe("RC-1023");
    expect(normalizeContainerId("1023")).toBe("RC-1023");
    expect(normalizeContainerId("BIN 1023")).toBe("RC-1023");
  });
});

describe("phone-normalizer", () => {
  it("normalizes to E.164", () => {
    expect(normalizePhone("(313) 555-0123")).toBe("+13135550123");
    expect(normalizePhone("+1 313 555 0123")).toBe("+13135550123");
  });

  it("returns null for invalid phones", () => {
    expect(normalizePhone("555")).toBeNull();
  });
});

describe("dedup-keys", () => {
  it("produces the same blocking key for legal-suffix variants", () => {
    const a = customerBlockingKey("Summit Construction LLC", "(313) 555-0123", "100 Main St");
    const b = customerBlockingKey("Summit Construction", "313-555-0123", "100 Main St");
    expect(a).toBe(b);
  });
});

describe("code-mapper", () => {
  it("maps legacy service codes", () => {
    const mapped = mapServiceCode("SW-COMM-2YD");
    expect(mapped).not.toBeNull();
    expect(mapped?.lineOfBusiness).toBe("frontload");
    expect(mapped?.sizeYards).toBe(2);
    expect(mapped?.frequency).toBe("weekly");
    expect(mapped?.confidence).toBe(1);
  });

  it("returns null only for empty input", () => {
    expect(mapServiceCode("")).toBeNull();
    expect(mapServiceCode("   ")).toBeNull();
  });
});

describe("eval metrics", () => {
  it("computes rates and passes the gate with zero silent errors", () => {
    const metrics = computeMetrics({
      totalRecords: 1000,
      autoMapped: 992,
      exceptionCount: 8,
      silentErrors: 0,
      confidenceSum: 0.9,
      confidenceCount: 1,
    });
    expect(metrics.autoMapRate).toBeCloseTo(0.992);
    expect(metrics.exceptionRate).toBeCloseTo(0.008);
    expect(evalGatePasses(metrics)).toBe(true);
  });

  it("fails the gate on silent errors", () => {
    const metrics = computeMetrics({
      totalRecords: 1000,
      autoMapped: 1000,
      exceptionCount: 0,
      silentErrors: 1,
      confidenceSum: 1,
      confidenceCount: 1,
    });
    expect(evalGatePasses(metrics)).toBe(false);
  });
});

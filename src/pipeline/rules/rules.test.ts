import { describe, expect, it } from "vitest";
import { normalizeDate } from "./date-normalizer";
import { normalizeContainerId } from "./id-normalizer";
import { normalizeCompanyName } from "./name-normalizer";
import { normalizePhone } from "./phone-normalizer";

describe("date-normalizer", () => {
  it("normalizes ISO dates", () => {
    expect(normalizeDate("2023-01-02")).toEqual({ iso: "2023-01-02", ambiguous: false });
    expect(normalizeDate("2023-1-2")).toEqual({ iso: "2023-01-02", ambiguous: false });
  });

  it("normalizes MM/DD/YYYY", () => {
    expect(normalizeDate("01/02/2023")).toEqual({ iso: "2023-01-02", ambiguous: false });
    expect(normalizeDate("12/31/2024")).toEqual({ iso: "2024-12-31", ambiguous: false });
  });

  it("normalizes DD-Mon-YY and DD-Mon-YYYY", () => {
    expect(normalizeDate("02-Jan-23")).toEqual({ iso: "2023-01-02", ambiguous: false });
    expect(normalizeDate("31-Dec-2024")).toEqual({ iso: "2024-12-31", ambiguous: false });
    expect(normalizeDate("1-mar-2020")).toEqual({ iso: "2020-03-01", ambiguous: false });
  });

  it("flags ambiguous 2-digit year MM/DD/YY and never guesses", () => {
    const result = normalizeDate("01/02/23");
    expect(result.iso).toBeNull();
    expect(result.ambiguous).toBe(true);
    expect(result.note).toBe("ambiguous 2-digit year");
  });

  it("flags unrecognized formats as ambiguous", () => {
    const result = normalizeDate("not-a-date");
    expect(result.iso).toBeNull();
    expect(result.ambiguous).toBe(true);
  });

  it("rejects invalid calendar dates", () => {
    expect(normalizeDate("02/30/2023").iso).toBeNull();
    expect(normalizeDate("13/01/2023").iso).toBeNull();
    expect(normalizeDate("2023-02-29").iso).toBeNull();
    expect(normalizeDate("2023-00-10").iso).toBeNull();
  });

  it("accepts leap day in leap years", () => {
    expect(normalizeDate("2024-02-29").iso).toBe("2024-02-29");
    expect(normalizeDate("02/29/2024").iso).toBe("2024-02-29");
  });

  it("handles empty input", () => {
    expect(normalizeDate("")).toEqual({ iso: null, ambiguous: false, note: "empty" });
    expect(normalizeDate("   ")).toEqual({ iso: null, ambiguous: false, note: "empty" });
  });
});

describe("phone-normalizer", () => {
  it("normalizes US formats to E.164", () => {
    expect(normalizePhone("(313) 555-0123")).toBe("+13135550123");
    expect(normalizePhone("313-555-0123")).toBe("+13135550123");
    expect(normalizePhone("+1 313 555 0123")).toBe("+13135550123");
    expect(normalizePhone("3135550123")).toBe("+13135550123");
    expect(normalizePhone("+13135550123")).toBe("+13135550123");
  });

  it("returns null for invalid phones", () => {
    expect(normalizePhone("555")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("911")).toBeNull();
    expect(normalizePhone("(011) 555-0123")).toBeNull();
    expect(normalizePhone("(313) 011-0123")).toBeNull();
    expect(normalizePhone("(313) 911-0123")).toBeNull();
    expect(normalizePhone("+44 20 7946 0958")).toBeNull();
  });
});

describe("id-normalizer", () => {
  it("canonicalizes container ids", () => {
    expect(normalizeContainerId("RC-1023")).toBe("RC-1023");
    expect(normalizeContainerId("1023")).toBe("RC-1023");
    expect(normalizeContainerId("BIN 1023")).toBe("RC-1023");
    expect(normalizeContainerId("RC 1023")).toBe("RC-1023");
    expect(normalizeContainerId("CONTAINER 1023")).toBe("RC-1023");
    expect(normalizeContainerId("rc-1023")).toBe("RC-1023");
    expect(normalizeContainerId("BIN-1023")).toBe("RC-1023");
  });

  it("strips leading zeros so ids resolve to the same container", () => {
    expect(normalizeContainerId("RC-01023")).toBe("RC-1023");
    expect(normalizeContainerId("01023")).toBe("RC-1023");
  });

  it("returns unrecognized input cleaned, never coerced", () => {
    expect(normalizeContainerId("  rc-1023  ")).toBe("RC-1023");
    expect(normalizeContainerId("NOPE")).toBe("NOPE");
    expect(normalizeContainerId("")).toBe("");
  });
});

describe("name-normalizer", () => {
  it("canonicalizes legal suffix variants", () => {
    expect(normalizeCompanyName("Summit Construction LLC")).toBe("Summit Construction LLC");
    expect(normalizeCompanyName("Summit Construction, Inc.")).toBe("Summit Construction Inc");
    expect(normalizeCompanyName("Summit Construction Corp")).toBe("Summit Construction Corp");
    expect(normalizeCompanyName("Summit Construction Co.")).toBe("Summit Construction Co");
    expect(normalizeCompanyName("Summit Construction Ltd")).toBe("Summit Construction Ltd");
    expect(normalizeCompanyName("Summit Construction Incorporated")).toBe("Summit Construction Inc");
    expect(normalizeCompanyName("Summit Construction Corporation")).toBe("Summit Construction Corp");
    expect(normalizeCompanyName("Summit Construction Company")).toBe("Summit Construction Co");
    expect(normalizeCompanyName("Summit Construction Limited")).toBe("Summit Construction Ltd");
  });

  it("normalizes case and whitespace", () => {
    expect(normalizeCompanyName("  summit   construction  llc ")).toBe("Summit Construction LLC");
    expect(normalizeCompanyName("summit construction")).toBe("Summit Construction");
    expect(normalizeCompanyName("S. CONSTRUCTION")).toBe("S. Construction");
  });

  it("handles empty input", () => {
    expect(normalizeCompanyName("")).toBe("");
    expect(normalizeCompanyName("   ")).toBe("");
  });
});

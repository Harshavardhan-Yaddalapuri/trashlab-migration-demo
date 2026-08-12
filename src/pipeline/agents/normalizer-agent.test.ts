import { describe, expect, it } from "vitest";
import { inferEntityType, normalizeAgent } from "./normalizer-agent";
import type { RawRecord } from "@/lib/types";

const NOW = "2026-08-12T00:00:00.000Z";

function ctx() {
  return { jobId: "job-1", tenantId: "demo", now: () => NOW };
}

function raw(id: string, payload: Record<string, string>): RawRecord {
  return {
    id,
    sourceFileId: "sf-1",
    sourceRow: 1,
    payload,
    rawHash: "raw",
  };
}

describe("normalizer: field rules", () => {
  it("normalizes company names (case, whitespace, legal suffixes)", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { name: "  summit   construction  llc ", phone: "3135550100" }),
    ]);
    expect(result.normalized[0].fields["name"]).toBe("Summit Construction LLC");
    expect(result.flagged).toHaveLength(0);
  });

  it("normalizes US phones to E.164", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { name: "Apex Disposal", phone: "(313) 555-0123" }),
    ]);
    expect(result.normalized[0].fields["phone"]).toBe("+13135550123");
  });

  it("flags invalid phones without mutating the payload", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { name: "Apex", phone: "911" }),
    ]);
    expect(result.normalized[0].fields["phone"]).toBe("911");
    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0]).toMatchObject({ rawRecordId: "r1", field: "phone" });
  });

  it("normalizes mixed date formats to ISO", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { name: "A", startDate: "01/02/2023" }),
      raw("r2", { name: "B", startDate: "2023-03-01" }),
      raw("r3", { name: "C", startDate: "02-Jan-23" }),
    ]);
    expect(result.normalized[0].fields["startDate"]).toBe("2023-01-02");
    expect(result.normalized[1].fields["startDate"]).toBe("2023-03-01");
    expect(result.normalized[2].fields["startDate"]).toBe("2023-01-02");
  });

  it("flags ambiguous 2-digit-year dates and never guesses", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { name: "A", startDate: "01/02/23" }),
    ]);
    expect(result.normalized[0].fields["startDate"]).toBe("01/02/23");
    expect(result.flagged[0]).toMatchObject({
      rawRecordId: "r1",
      field: "startDate",
      note: "ambiguous 2-digit year",
    });
  });

  it("flags invalid calendar dates", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { name: "A", startDate: "02/30/2023" }),
    ]);
    expect(result.normalized[0].fields["startDate"]).toBe("02/30/2023");
    expect(result.flagged[0].note).toBe("invalid date");
  });

  it("canonicalizes container ids", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { containerId: "BIN 1023" }),
      raw("r2", { containerId: "rc-2044" }),
    ]);
    expect(result.normalized[0].fields["containerId"]).toBe("RC-1023");
    expect(result.normalized[1].fields["containerId"]).toBe("RC-2044");
  });

  it("flags unrecognized container ids instead of coercing", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { containerId: "NOPE" }),
    ]);
    expect(result.normalized[0].fields["containerId"]).toBe("NOPE");
    expect(result.flagged[0].field).toBe("containerId");
  });

  it("never treats non-container entity ids as container ids", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { id: "C-00001", name: "Summit Construction LLC", phone: "3135550100" }),
      raw("r2", { id: "A-00001", serviceCode: "SW-COMM-2YD" }),
    ]);
    expect(result.normalized[0].fields["id"]).toBe("C-00001");
    expect(result.normalized[1].fields["id"]).toBe("A-00001");
    expect(result.flagged).toHaveLength(0);
  });

  it("converts money strings to integer cents", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { rateCents: "120.50" }),
      raw("r2", { rateCents: "$400" }),
    ]);
    expect(result.normalized[0].fields["rateCents"]).toBe("12050");
    expect(result.normalized[1].fields["rateCents"]).toBe("40000");
  });

  it("flags invalid money without mutating", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { rateCents: "abc" }),
    ]);
    expect(result.normalized[0].fields["rateCents"]).toBe("abc");
    expect(result.flagged[0]).toMatchObject({ field: "rateCents", note: "invalid money" });
  });
});

describe("normalizer: entity inference", () => {
  it("infers customer from name + phone", () => {
    expect(inferEntityType({ name: "A", phone: "3135550100" })).toBe("customer");
  });

  it("infers agreement from serviceCode", () => {
    expect(inferEntityType({ name: "A", serviceCode: "SW-COMM-2YD" })).toBe("agreement");
    expect(inferEntityType({ name: "A", startDate: "2023-01-01", status: "active" })).toBe(
      "agreement",
    );
  });

  it("infers container from sizeYards or type", () => {
    expect(inferEntityType({ containerId: "RC-1", sizeYards: "20" })).toBe("container");
    expect(inferEntityType({ containerId: "RC-1", type: "rolloff" })).toBe("container");
  });

  it("infers ticket from date + grossTons", () => {
    expect(inferEntityType({ date: "2023-01-02", grossTons: "4.5" })).toBe("ticket");
  });

  it("infers route from dayOfWeek or siteIds", () => {
    expect(inferEntityType({ name: "R-01", dayOfWeek: "Mon" })).toBe("route");
    expect(inferEntityType({ name: "R-01", siteIds: "S-1,S-2" })).toBe("route");
  });

  it("infers site from name + address without service markers", () => {
    expect(inferEntityType({ name: "Summit - Site 1", address: "123 Main St" })).toBe("site");
  });

  it("stays unknown rather than guessing", () => {
    expect(inferEntityType({})).toBe("unknown");
    expect(inferEntityType({ name: "A" })).toBe("unknown");
  });

  it("assigns the inferred entity type to the normalized record", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { name: "A", phone: "3135550100", serviceCode: "SW-COMM-2YD" }),
    ]);
    expect(result.normalized[0].entityType).toBe("agreement");
  });
});

describe("normalizer: event emission", () => {
  it("emits one RecordNormalized event per record", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { name: "A", phone: "3135550100" }),
      raw("r2", { name: "B", phone: "3135550101" }),
    ]);
    const normalizedEvents = result.events.filter((e) => e.type === "RecordNormalized");
    expect(normalizedEvents).toHaveLength(2);
    expect(normalizedEvents[0]).toMatchObject({
      type: "RecordNormalized",
      recordId: "n-r1",
      entityType: "customer",
    });
  });

  it("emits AmbiguityFlagged events with field and note", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { name: "A", startDate: "01/02/23" }),
    ]);
    const flaggedEvents = result.events.filter((e) => e.type === "AmbiguityFlagged");
    expect(flaggedEvents).toHaveLength(1);
    expect(flaggedEvents[0]).toMatchObject({
      type: "AmbiguityFlagged",
      recordId: "n-r1",
      field: "startDate",
      note: "ambiguous 2-digit year",
    });
  });

  it("does not emit AmbiguityFlagged for clean records", async () => {
    const result = await normalizeAgent.run(ctx(), [
      raw("r1", { name: "A", phone: "3135550100", startDate: "01/02/2023" }),
    ]);
    expect(result.events.some((e) => e.type === "AmbiguityFlagged")).toBe(false);
  });
});

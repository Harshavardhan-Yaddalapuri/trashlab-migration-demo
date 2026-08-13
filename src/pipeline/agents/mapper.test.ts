import { describe, expect, it } from "vitest";
import { generateDataset } from "@/data/generate";
import { mapperAgent } from "./mapper";
import type { ResolvedEntity } from "@/lib/types";

const NOW = "2026-08-12T00:00:00.000Z";

function ctx() {
  return { jobId: "job-1", tenantId: "demo", now: () => NOW };
}

function resolvedEntity(id: string, fields: Record<string, string>, entityType: string = "agreement"): ResolvedEntity {
  return {
    id,
    entityType: entityType as ResolvedEntity["entityType"],
    clusterId: `c-${id}`,
    confidence: 1,
    merged: false,
    canonicalFields: fields,
  };
}

describe("mapper agent: correctness", () => {
  it("maps a canonical service code with full confidence", async () => {
    const entities: ResolvedEntity[] = [resolvedEntity("a1", { serviceCode: "SW-COMM-2YD" })];
    const result = await mapperAgent.run(ctx(), entities);

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].confidence).toBe(1);
    expect(result.proposals[0].ruleVersion).toBe("rules-v1");
    expect(result.proposals[0].mappedFields?.lineOfBusiness).toBe("frontload");
    expect(result.proposals[0].mappedFields?.sizeYards).toBe(2);
    expect(result.proposals[0].mappedFields?.frequency).toBe("weekly");
    expect(result.autoMapped).toBe(1);
    expect(result.exceptions).toHaveLength(0);
  });

  it("maps a variant token with high but not full confidence", async () => {
    const entities: ResolvedEntity[] = [resolvedEntity("a2", { serviceCode: "SW-FL-2YD" })];
    const result = await mapperAgent.run(ctx(), entities);

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].confidence).toBe(0.92);
    expect(result.autoMapped).toBe(1);
  });

  it("raises an exception for a retired service code", async () => {
    const entities: ResolvedEntity[] = [resolvedEntity("a3", { serviceCode: "SW-OPEN-20YD" })];
    const result = await mapperAgent.run(ctx(), entities);

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].mappedFields?.retired).toBe(true);
    expect(result.proposals[0].mappedFields?.retiredAs).toBe("SW-RO-20YD");
    expect(result.autoMapped).toBe(0);
    expect(result.exceptions).toHaveLength(1);
    expect(result.exceptions[0].type).toBe("low_mapping_confidence");
  });

  it("raises an exception for an unmappable legacy code", async () => {
    const entities: ResolvedEntity[] = [resolvedEntity("a4", { serviceCode: "NOPE-1" })];
    const result = await mapperAgent.run(ctx(), entities);

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].confidence).toBeLessThan(0.7);
    expect(result.autoMapped).toBe(0);
    expect(result.exceptions).toHaveLength(1);
  });

  it("raises an exception for missing service code", async () => {
    const entities: ResolvedEntity[] = [resolvedEntity("a5", {})];
    const result = await mapperAgent.run(ctx(), entities);

    expect(result.proposals).toHaveLength(0);
    expect(result.autoMapped).toBe(0);
    expect(result.exceptions).toHaveLength(1);
    expect(result.exceptions[0].type).toBe("missing_service_code");
  });

  it("skips non-agreement entities", async () => {
    const entities: ResolvedEntity[] = [
      resolvedEntity("c1", { name: "Summit Construction" }, "customer"),
      resolvedEntity("s1", { name: "Site 1" }, "site"),
    ];
    const result = await mapperAgent.run(ctx(), entities);

    expect(result.proposals).toHaveLength(0);
    expect(result.exceptions).toHaveLength(0);
  });

  it("classifies confidence distribution for a mixed code sample", async () => {
    const codes = [
      "SW-COMM-2YD",     // 1.0
      "SW-RO-30YD",      // 1.0
      "SW-FL-4YD",       // 0.92
      "SW-OPEN-20YD",    // 0.6 retired
      "NOPE-1",          // low
      "SW-RES-1-W",      // 1.0
      "SW-COMM-XX",      // unknown lob
    ];
    const entities = codes.map((code, i) => resolvedEntity(`m-${i}`, { serviceCode: code }));
    const result = await mapperAgent.run(ctx(), entities);

    expect(result.proposals).toHaveLength(codes.length);
    const high = result.proposals.filter((p) => p.confidence >= 0.7);
    const low = result.proposals.filter((p) => p.confidence < 0.7);
    expect(high.length).toBeGreaterThanOrEqual(4);
    expect(low.length).toBeGreaterThanOrEqual(2);
    expect(result.exceptions.length).toBe(low.length);
    expect(result.autoMapped).toBe(high.length);
  });
});

describe("mapper agent: scale", () => {
  it("maps all 18,000 agreement service codes in under 2 seconds", async () => {
    const dataset = generateDataset();
    const entities: ResolvedEntity[] = dataset.agreements.map((ag) => ({
      id: ag.id,
      rawRecordId: `raw-${ag.id}`,
      entityType: "agreement",
      clusterId: `c-${ag.id}`,
      confidence: 1,
      merged: false,
      canonicalFields: { serviceCode: ag.serviceCode },
    }));

    const start = performance.now();
    const result = await mapperAgent.run(ctx(), entities);
    const elapsed = performance.now() - start;

    expect(entities.length).toBe(18_000);
    expect(result.proposals.length).toBe(18_000);
    expect(result.proposals.length + result.exceptions.length).toBeGreaterThanOrEqual(18_000);
    expect(elapsed).toBeLessThan(2000);
  });
});

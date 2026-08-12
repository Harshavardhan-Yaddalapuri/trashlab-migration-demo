import { describe, expect, it } from "vitest";
import { generateDataset } from "@/data/generate";
import { entityResolverAgent } from "./entity-resolver";
import type { NormalizedRecord } from "@/lib/types";

const NOW = "2026-08-12T00:00:00.000Z";

function ctx() {
  return { jobId: "job-1", tenantId: "demo", now: () => NOW };
}

function normalizedCustomer(
  id: string,
  fields: Record<string, string>,
): NormalizedRecord {
  return {
    id,
    rawRecordId: `raw-${id}`,
    entityType: "customer",
    fields,
    normalizedAt: NOW,
  };
}

describe("entity-resolver: small-scale correctness", () => {
  it("auto-merges duplicate customer variants above threshold", async () => {
    const records = [
      normalizedCustomer("r1", {
        name: "Summit Construction LLC",
        phone: "3135550123",
        address: "100 Main St",
        city: "Detroit",
        state: "MI",
        zip: "48201",
      }),
      normalizedCustomer("r2", {
        name: "Summit Construction",
        phone: "313-555-0123",
        address: "100 Main Street",
        city: "Detroit",
        state: "MI",
        zip: "48201",
      }),
    ];

    const result = await entityResolverAgent.run(ctx(), records);

    expect(result.resolved).toHaveLength(1);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].memberIds).toContain("r1");
    expect(result.clusters[0].memberIds).toContain("r2");
    expect(result.autoMerged).toBe(1);
    expect(result.needsReview).toBe(0);
  });

  it("flags low-confidence clusters for review", async () => {
    const records = [
      normalizedCustomer("r1", {
        name: "Summit Construction",
        phone: "3135550123",
        address: "100 Main St",
        city: "Detroit",
        state: "MI",
        zip: "48201",
      }),
      normalizedCustomer("r2", {
        name: "Summit Constrution",
        phone: "3135550123",
        address: "200 Oak Ave",
        city: "Detroit",
        state: "MI",
        zip: "48201",
      }),
    ];

    const result = await entityResolverAgent.run(ctx(), records);

    expect(result.resolved).toHaveLength(1);
    expect(result.needsReview).toBe(1);
    expect(result.autoMerged).toBe(0);
  });

  it("keeps distinct customers separate", async () => {
    const records = [
      normalizedCustomer("r1", {
        name: "Summit Construction",
        phone: "3135550123",
        address: "100 Main St",
      }),
      normalizedCustomer("r2", {
        name: "Apex Waste",
        phone: "2485550999",
        address: "200 Oak Ave",
      }),
    ];

    const result = await entityResolverAgent.run(ctx(), records);

    expect(result.resolved).toHaveLength(2);
    expect(result.clusters).toHaveLength(2);
    expect(result.autoMerged).toBe(0);
    expect(result.needsReview).toBe(0);
  });

  it("passes non-customer records through unchanged", async () => {
    const records: NormalizedRecord[] = [
      {
        id: "n-site-1",
        rawRecordId: "raw-site-1",
        entityType: "site",
        fields: { name: "Summit - Site 1", address: "100 Main St" },
        normalizedAt: NOW,
      },
    ];

    const result = await entityResolverAgent.run(ctx(), records);

    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].entityType).toBe("site");
    expect(result.resolved[0].merged).toBe(false);
    expect(result.resolved[0].canonicalFields["address"]).toBe("100 Main St");
  });

  it("detects address conflicts within a cluster", async () => {
    const records = [
      normalizedCustomer("r1", {
        name: "Summit Construction LLC",
        phone: "3135550123",
        address: "100 Main St",
        city: "Detroit",
        state: "MI",
        zip: "48201",
      }),
      normalizedCustomer("r2", {
        name: "Summit Construction",
        phone: "313-555-0123",
        address: "200 Oak Ave",
        city: "Detroit",
        state: "MI",
        zip: "48201",
      }),
    ];

    const result = await entityResolverAgent.run(ctx(), records);

    expect(result.autoMerged).toBe(0);
    expect(result.needsReview).toBe(1);
  });

  it("detects pricing conflicts from agreement fields", async () => {
    const records = [
      normalizedCustomer("r1", {
        name: "Summit Construction LLC",
        phone: "3135550123",
        address: "100 Main St",
        agreement: JSON.stringify({ siteId: "S-00001", containerId: "RC-1023", rateCents: "12000" }),
      }),
      normalizedCustomer("r2", {
        name: "Summit Construction",
        phone: "313-555-0123",
        address: "100 Main St",
        agreement: JSON.stringify({ siteId: "S-00001", containerId: "RC-1023", rateCents: "13500" }),
      }),
    ];

    const result = await entityResolverAgent.run(ctx(), records);

    expect(result.resolved).toHaveLength(1);
    expect(result.autoMerged).toBe(1);
  });
});

describe("entity-resolver: performance and scale", () => {
  it("resolves 45,000 seeded customers in under 5 seconds", async () => {
    const dataset = generateDataset();
    const records: NormalizedRecord[] = dataset.customers.map((c) => ({
      id: c.id,
      rawRecordId: `raw-${c.id}`,
      entityType: "customer",
      fields: {
        name: c.name,
        phone: c.phone,
        address: c.address,
        city: c.city,
        state: c.state,
        zip: c.zip,
      },
      normalizedAt: NOW,
    }));

    const start = performance.now();
    const result = await entityResolverAgent.run(ctx(), records);
    const elapsed = performance.now() - start;

    expect(records.length).toBe(45_000);
    expect(result.resolved.length).toBeGreaterThan(2_000);
    expect(result.clusters.length).toBeGreaterThan(2_000);
    expect(result.autoMerged).toBeGreaterThan(0);
    expect(result.needsReview).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5000);
  });
});

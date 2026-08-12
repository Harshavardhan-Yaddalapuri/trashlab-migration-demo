import { describe, expect, it } from "vitest";
import { generateDataset } from "../../data/generate";
import {
  customerBlockingKey,
  customerSimilarity,
  jaccardSimilarity,
  normalizeAddress,
  phoneticKey,
  resolveCustomers,
  similarity,
} from "./dedup-keys";

describe("blocking keys", () => {
  it("produces the same phonetic key for legal-suffix variants", () => {
    expect(phoneticKey("Summit Construction LLC")).toBe(phoneticKey("Summit Construction"));
    expect(phoneticKey("Summit Construction Inc.")).toBe(phoneticKey("Summit Construction Incorporated"));
  });

  it("normalizes address street suffixes", () => {
    expect(normalizeAddress("100 Main Street")).toBe("100 MAIN ST");
    expect(normalizeAddress("200 Oak Avenue")).toBe("200 OAK AVE");
    expect(normalizeAddress("300 Cedar Road")).toBe("300 CEDAR RD");
    expect(normalizeAddress("400 Washington Boulevard")).toBe("400 WASHINGTON BLVD");
    expect(normalizeAddress("500 Lincoln Drive")).toBe("500 LINCOLN DR");
    expect(normalizeAddress("600 Jefferson Lane")).toBe("600 JEFFERSON LN");
  });

  it("produces the same blocking key for name/phone variants", () => {
    const a = customerBlockingKey({
      id: "a",
      name: "Summit Construction LLC",
      phone: "(313) 555-0123",
      address: "100 Main St",
    });
    const b = customerBlockingKey({
      id: "b",
      name: "Summit Construction",
      phone: "313-555-0123",
      address: "100 Main Street",
    });
    expect(a).toBe(b);
  });

  it("uses the normalized phone in the blocking key", () => {
    const a = customerBlockingKey({ id: "a", name: "Apex Waste", phone: "+1 313 555 0199", address: "1 Oak Ave" });
    const b = customerBlockingKey({ id: "b", name: "Apex Waste", phone: "3135550199", address: "1 Oak Ave" });
    expect(a).toBe(b);
  });

  it("puts different phones into different buckets", () => {
    const a = customerBlockingKey({ id: "a", name: "Apex Waste", phone: "3135550199", address: "1 Oak Ave" });
    const b = customerBlockingKey({ id: "b", name: "Apex Waste", phone: "2485550199", address: "1 Oak Ave" });
    expect(a).not.toBe(b);
  });
});

describe("similarity", () => {
  it("returns 1 for identical strings", () => {
    expect(similarity("Summit Construction", "Summit Construction")).toBe(1);
  });

  it("returns 0 for completely different strings", () => {
    expect(similarity("abc", "xyz")).toBe(0);
  });

  it("scores close typos highly", () => {
    const s = similarity("Summit Construction", "Summit Constrution");
    expect(s).toBeGreaterThan(0.9);
    expect(s).toBeLessThan(1);
  });

  it("scores initial-based variants lower than full names", () => {
    const full = similarity("Summit Construction", "Summit Construction");
    const initial = similarity("Summit Construction", "S. Construction");
    expect(initial).toBeLessThan(full);
  });

  it("computes Jaccard similarity for addresses", () => {
    expect(jaccardSimilarity("100 Main St", "100 Main Street")).toBe(0.5);
    expect(jaccardSimilarity("100 Main St", "200 Oak Ave")).toBeLessThan(0.5);
  });

  it("weights phone and address heavily in customer similarity", () => {
    const sameEverything = customerSimilarity(
      { id: "a", name: "Summit Construction", phone: "3135550123", address: "100 Main St" },
      { id: "b", name: "Summit Construction", phone: "3135550123", address: "100 Main St" },
    );
    expect(sameEverything).toBeGreaterThanOrEqual(0.9);

    const diffPhone = customerSimilarity(
      { id: "a", name: "Summit Construction", phone: "3135550123", address: "100 Main St" },
      { id: "b", name: "Summit Construction", phone: "2485550123", address: "100 Main St" },
    );
    expect(diffPhone).toBeLessThan(1);
    expect(diffPhone).toBeGreaterThan(0);
  });

  it("boosts similarity when emails match", () => {
    const base = { id: "a", name: "Summit Construction", phone: "3135550123", address: "100 Main St" };
    const withEmail = {
      ...base,
      email: "billing@summitconstruction.example",
    };
    const withoutEmail = { ...base, email: null };
    expect(customerSimilarity(withEmail, withEmail)).toBe(1);
    expect(customerSimilarity(withEmail, withoutEmail)).toBeLessThan(1);
  });
});

describe("cluster merge", () => {
  it("auto-merges identical records above threshold", () => {
    const records = [
      { id: "r1", name: "Summit Construction LLC", phone: "3135550123", address: "100 Main St" },
      { id: "r2", name: "Summit Construction", phone: "313-555-0123", address: "100 Main Street" },
    ];
    const report = resolveCustomers(records, { autoMergeThreshold: 0.9, mergeThreshold: 0.7 });
    expect(report.totalRecords).toBe(2);
    expect(report.clusters).toHaveLength(1);
    expect(report.clusters[0].merged).toBe(true);
    expect(report.clusters[0].memberIds).toContain("r1");
    expect(report.clusters[0].memberIds).toContain("r2");
    expect(report.autoMerged).toBe(1);
  });

  it("keeps dissimilar records separate when blocking key differs", () => {
    const records = [
      { id: "r1", name: "Summit Construction", phone: "3135550123", address: "100 Main St" },
      { id: "r2", name: "Apex Waste", phone: "2485550999", address: "200 Oak Ave" },
    ];
    const report = resolveCustomers(records, { autoMergeThreshold: 0.9, mergeThreshold: 0.7 });
    expect(report.clusters).toHaveLength(2);
    expect(report.autoMerged).toBe(0);
    expect(report.needsReview).toBe(0);
  });

  it("flags a cluster for review when confidence is below auto-merge", () => {
    const records = [
      { id: "r1", name: "Summit Construction", phone: "3135550123", address: "100 Main St" },
      { id: "r2", name: "Summit Constrution", phone: "3135550123", address: "200 Oak Ave" },
    ];
    const report = resolveCustomers(records, { autoMergeThreshold: 0.95, mergeThreshold: 0.5 });
    expect(report.clusters).toHaveLength(1);
    expect(report.clusters[0].merged).toBe(false);
    expect(report.needsReview).toBe(1);
  });

  it("transitively merges records linked by pairwise similarity", () => {
    const records = [
      { id: "r1", name: "Summit Construction LLC", phone: "3135550123", address: "100 Main St" },
      { id: "r2", name: "Summit Construction", phone: "313-555-0123", address: "100 Main St" },
      { id: "r3", name: "Summit Constrution LLC", phone: "(313) 555-0123", address: "100 Main Street" },
    ];
    const report = resolveCustomers(records, { autoMergeThreshold: 0.9, mergeThreshold: 0.7 });
    expect(report.clusters).toHaveLength(1);
    expect(report.clusters[0].memberIds).toHaveLength(3);
  });
});

describe("conflict detection", () => {
  it("flags address conflicts within a cluster", () => {
    const records = [
      { id: "r1", name: "Summit Construction LLC", phone: "3135550123", address: "100 Main St" },
      { id: "r2", name: "Summit Construction", phone: "313-555-0123", address: "200 Oak Ave" },
    ];
    const report = resolveCustomers(records, { autoMergeThreshold: 0.95, mergeThreshold: 0.5 });
    const cluster = report.clusters[0];
    expect(cluster.conflicts.some((c) => c.kind === "address")).toBe(true);
    expect(report.conflictCount).toBe(1);
  });

  it("flags pricing conflicts when agreement data is attached", () => {
    const records = [
      {
        id: "r1",
        name: "Summit Construction LLC",
        phone: "3135550123",
        address: "100 Main St",
        agreement: { siteId: "S-00001", containerId: "RC-1023", rateCents: 12_000 },
      },
      {
        id: "r2",
        name: "Summit Construction",
        phone: "313-555-0123",
        address: "100 Main St",
        agreement: { siteId: "S-00001", containerId: "RC-1023", rateCents: 13_500 },
      },
    ];
    const report = resolveCustomers(records, { autoMergeThreshold: 0.9, mergeThreshold: 0.7 });
    const cluster = report.clusters[0];
    const pricing = cluster.conflicts.find((c) => c.kind === "pricing");
    expect(pricing).toBeDefined();
    expect(pricing?.severity).toBe("critical");
    expect(pricing?.evidence).toContain("$120.00");
    expect(pricing?.evidence).toContain("$135.00");
  });

  it("does not flag pricing conflicts when rates match", () => {
    const records = [
      {
        id: "r1",
        name: "Summit Construction LLC",
        phone: "3135550123",
        address: "100 Main St",
        agreement: { siteId: "S-00001", containerId: "RC-1023", rateCents: 12_000 },
      },
      {
        id: "r2",
        name: "Summit Construction",
        phone: "313-555-0123",
        address: "100 Main St",
        agreement: { siteId: "S-00001", containerId: "RC-1023", rateCents: 12_000 },
      },
    ];
    const report = resolveCustomers(records, { autoMergeThreshold: 0.9, mergeThreshold: 0.7 });
    expect(report.clusters[0].conflicts.some((c) => c.kind === "pricing")).toBe(false);
  });
});

describe("performance", () => {
  it("resolves 45k seeded customers in under 5 seconds", () => {
    const dataset = generateDataset();
    const customers = dataset.customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
    }));

    const start = performance.now();
    const report = resolveCustomers(customers, { autoMergeThreshold: 0.9, mergeThreshold: 0.5 });
    const elapsed = performance.now() - start;

    expect(customers.length).toBe(45_000);
    expect(report.totalRecords).toBe(45_000);
    expect(elapsed).toBeLessThan(5000);
  });
});

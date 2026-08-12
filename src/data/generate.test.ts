import { describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import { normalizePhone } from "@/pipeline/rules/phone-normalizer";
import { generateDataset, hashDataset, mulberry32 } from "./generate";

const counts = config.demo.counts;
const expectedTotal =
  counts.customers + counts.sites + counts.containers + counts.agreements + counts.routes + counts.tickets;

describe("seeded dataset generator", () => {
  it("generates exactly 150,000 records with the locked mix", () => {
    const dataset = generateDataset();
    expect(dataset.total).toBe(150_000);
    expect(dataset.customers).toHaveLength(45_000);
    expect(dataset.sites).toHaveLength(35_000);
    expect(dataset.containers).toHaveLength(40_000);
    expect(dataset.agreements).toHaveLength(18_000);
    expect(dataset.routes).toHaveLength(7_000);
    expect(dataset.tickets).toHaveLength(5_000);
  });

  it("is deterministic: same seed produces byte-identical data", () => {
    const a = generateDataset(20260812);
    const b = generateDataset(20260812);
    expect(hashDataset(a)).toBe(hashDataset(b));
    expect(a.customers[0]).toEqual(b.customers[0]);
    expect(a.containers[12_345]).toEqual(b.containers[12_345]);
    expect(a.agreements[17_999]).toEqual(b.agreements[17_999]);
  });

  it("produces different data for a different seed", () => {
    const a = generateDataset(20260812);
    const b = generateDataset(1);
    expect(hashDataset(a)).not.toBe(hashDataset(b));
  });

  it("mulberry32 is deterministic and bounded", () => {
    const rng = mulberry32(42);
    const first = rng();
    const again = mulberry32(42)();
    expect(first).toBe(again);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
  });

  it("bakes in duplicate customer clusters (> 2000)", () => {
    const dataset = generateDataset();
    const clusters = new Set(
      dataset.customers.filter((c) => c.clusterId !== null).map((c) => c.clusterId as string),
    );
    expect(clusters.size).toBeGreaterThan(2_000);
    expect(clusters.size).toBe(config.demo.dirt.duplicateClusters);
    const variants = dataset.customers.filter((c) => c.isVariant);
    expect(variants.length).toBeGreaterThan(2_000);
    // Every variant shares name/phone/address lineage with its cluster anchor.
    const anchor = dataset.customers.find((c) => c.clusterId === variants[0].clusterId && !c.isVariant);
    expect(anchor).toBeDefined();
    // Same E.164 after normalization, even though the raw formatting differs.
    expect(normalizePhone(variants[0].phone)).toBe(normalizePhone(anchor!.phone));
  });

  it("bakes in conflicting pricing (> 100 same container+site pairs with two rates)", () => {
    const dataset = generateDataset();
    const key = (a: { containerId: string; siteId: string }): string => `${a.containerId}|${a.siteId}`;
    const ratesByKey = new Map<string, Set<number>>();
    for (const agreement of dataset.agreements) {
      const k = key(agreement);
      const set = ratesByKey.get(k) ?? new Set<number>();
      set.add(agreement.rateCents);
      ratesByKey.set(k, set);
    }
    let conflicts = 0;
    for (const set of ratesByKey.values()) {
      if (set.size > 1) conflicts += 1;
    }
    expect(conflicts).toBeGreaterThan(100);
    expect(conflicts).toBe(config.demo.dirt.conflictingPricingPairs);
  });

  it("bakes in the remaining dirt classes", () => {
    const dataset = generateDataset();
    expect(dataset.containers.filter((c) => c.siteId === null).length).toBeGreaterThan(0);
    expect(dataset.agreements.filter((a) => a.status === "closed" && !a.billed).length).toBeGreaterThan(0);
    expect(dataset.tickets.filter((t) => t.containerId === null).length).toBeGreaterThan(0);
    expect(dataset.sites.filter((s) => !s.geocodable).length).toBeGreaterThan(0);
    expect(dataset.agreements.filter((a) => a.serviceCode.startsWith("NOPE")).length).toBeGreaterThan(0);
  });

  it("mixes date formats and container id formats", () => {
    const dataset = generateDataset();
    const dates = dataset.agreements.slice(0, 500).map((a) => a.startDate);
    expect(dates.some((d) => /^\d{2}\/\d{2}\/\d{4}$/.test(d))).toBe(true);
    expect(dates.some((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);
    expect(dates.some((d) => /^\d{2}-[A-Za-z]{3}-\d{2}$/.test(d))).toBe(true);
    expect(dates.some((d) => /^\d{2}\/\d{2}\/\d{2}$/.test(d))).toBe(true);

    const ids = dataset.containers.slice(0, 500).map((c) => c.id);
    expect(ids.some((id) => /^RC-\d+$/.test(id))).toBe(true);
    expect(ids.some((id) => /^\d+$/.test(id))).toBe(true);
    expect(ids.some((id) => /^BIN \d+$/.test(id))).toBe(true);
  });

  it("keeps money as integer cents", () => {
    const dataset = generateDataset();
    for (const agreement of dataset.agreements) {
      expect(Number.isInteger(agreement.rateCents)).toBe(true);
    }
  });

  it("keeps referential integrity for non-orphan records", () => {
    const dataset = generateDataset();
    const siteIds = new Set(dataset.sites.map((s) => s.id));
    const customerIds = new Set(dataset.customers.map((c) => c.id));
    for (const site of dataset.sites) {
      expect(customerIds.has(site.customerId)).toBe(true);
    }
    for (const container of dataset.containers) {
      if (container.siteId !== null) {
        expect(siteIds.has(container.siteId)).toBe(true);
      }
    }
    for (const agreement of dataset.agreements) {
      expect(customerIds.has(agreement.customerId)).toBe(true);
      expect(siteIds.has(agreement.siteId)).toBe(true);
    }
  });

  it("sums to the configured total", () => {
    expect(expectedTotal).toBe(config.demo.totalRecords);
  });
});

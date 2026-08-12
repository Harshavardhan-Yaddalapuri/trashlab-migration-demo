/**
 * Seed script: generates the deterministic 150,000-record demo dataset.
 * Run with: npm run db:seed
 *
 * Prints a count gate (must equal 150,000) and a dirt summary so the
 * migration pipeline has known, reproducible defects to chew on.
 */

import { config } from "@/lib/config";
import { generateDataset, hashDataset } from "./generate";

function main(): void {
  const dataset = generateDataset();
  const counts = config.demo.counts;

  const expected =
    counts.customers + counts.sites + counts.containers + counts.agreements + counts.routes + counts.tickets;
  if (dataset.total !== expected) {
    throw new Error(`Count gate failed: generated ${dataset.total}, expected ${expected}`);
  }

  const duplicateClusters = new Set(
    dataset.customers.filter((c) => c.clusterId !== null).map((c) => c.clusterId as string),
  ).size;
  const variants = dataset.customers.filter((c) => c.isVariant).length;
  const orphans = dataset.containers.filter((c) => c.siteId === null).length;
  const closedUnbilled = dataset.agreements.filter((a) => a.status === "closed" && !a.billed).length;
  const unmatched = dataset.tickets.filter((t) => t.containerId === null).length;
  const ungeocodable = dataset.sites.filter((s) => !s.geocodable).length;
  const unmappable = dataset.agreements.filter((a) => a.serviceCode.startsWith("NOPE") || a.serviceCode.startsWith("LEGACY") || a.serviceCode.startsWith("OLD") || a.serviceCode.includes("XX")).length;

  console.log(`Seeded ${dataset.total} records (hash ${hashDataset(dataset)}):`);
  console.log(`  customers:   ${dataset.customers.length} (${duplicateClusters} dup clusters, ${variants} variants)`);
  console.log(`  sites:       ${dataset.sites.length} (${ungeocodable} un-geocodable)`);
  console.log(`  containers:  ${dataset.containers.length} (${orphans} orphans)`);
  console.log(`  agreements:  ${dataset.agreements.length} (${closedUnbilled} closed-but-unbilled, ${unmappable} unmappable codes)`);
  console.log(`  routes:      ${dataset.routes.length}`);
  console.log(`  tickets:     ${dataset.tickets.length} (${unmatched} unmatched)`);
}

main();

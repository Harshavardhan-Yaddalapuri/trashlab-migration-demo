/**
 * Export script: writes the deterministic 150,000-record demo dataset
 * to 4 real source files that match the intake format specs exactly.
 *
 * Run with: npx tsx scripts/export-source-files.ts
 * Output:   ~/trashlab-demo/sample-data/
 *   - routepro_2019_export.csv        (RoutePro CSV, quoted)
 *   - quickbooks_customer_export.tsv  (QuickBooks export, quoted)
 *   - transfer_station_weights.xlsx   (transfer spreadsheet, whitespace-aligned)
 *   - legacy_paper_export.tab         (paper-era fixed-width export)
 *
 * These are the files you upload in the demo's file-drop view.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { generateDataset } from "../src/data/generate";
import type { CustomerRecord, SiteRecord, ContainerRecord, AgreementRecord, RouteRecord, TicketRecord } from "../src/data/generate";

const OUT_DIR = join(process.cwd(), "sample-data");

function csvQuote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function padRight(value: string, width: number): string {
  return value.padEnd(width, " ").slice(0, width);
}

function buildRouteProCsv(dataset: {
  customers: CustomerRecord[];
  containers: ContainerRecord[];
  routes: RouteRecord[];
}): string {
  const lines: string[] = [];
  lines.push("name,phone,address,city,state,zip,sizeYards,type,dayOfWeek");
  for (const c of dataset.customers) {
    lines.push(
      [
        csvQuote(c.name),
        csvQuote(c.phone),
        csvQuote(c.address),
        csvQuote(c.city),
        csvQuote(c.state),
        csvQuote(c.zip),
        "20",
        "rolloff",
        "Mon",
      ].join(","),
    );
  }
  for (const c of dataset.containers) {
    lines.push(
      [
        csvQuote(`Container ${c.canonicalId}`),
        csvQuote("313-555-0000"),
        csvQuote("Yard"),
        csvQuote("Springfield"),
        csvQuote("IL"),
        csvQuote("62701"),
        String(c.sizeYards),
        c.type,
        "Tue",
      ].join(","),
    );
  }
  for (const r of dataset.routes) {
    lines.push(
      [
        csvQuote(`Route ${r.name}`),
        csvQuote("313-555-0000"),
        csvQuote("Yard"),
        csvQuote("Springfield"),
        csvQuote("IL"),
        csvQuote("62701"),
        "20",
        "rolloff",
        r.dayOfWeek,
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

function buildQuickBooksCsv(dataset: { agreements: AgreementRecord[] }): string {
  const lines: string[] = [];
  lines.push("name,serviceCode,startDate,rateCents");
  for (const a of dataset.agreements) {
    lines.push(
      [
        csvQuote(`Customer ${a.customerId}`),
        csvQuote(a.serviceCode),
        csvQuote(a.startDate),
        String(a.rateCents),
      ].join(","),
    );
  }
  lines.push("Total,150000,,");
  return lines.join("\n") + "\n";
}

function buildTransferSpreadsheet(dataset: { tickets: TicketRecord[] }): string {
  const lines: string[] = [];
  lines.push("# Transfer Station Log - Springfield East");
  lines.push("date:  containerId:  grossTons:");
  for (const t of dataset.tickets) {
    const container = t.containerId ?? "UNKNOWN";
    lines.push(`${t.date.padEnd(10)}  ${container.padEnd(14)}  ${t.grossTons.toFixed(1)}`);
  }
  return lines.join("\n") + "\n";
}

function buildLegacyExport(dataset: { sites: SiteRecord[] }): string {
  const lines: string[] = [];
  lines.push("NAME/SERVICE/ADDRESS/ROUTE/ZONE/CONTACT");
  for (const s of dataset.sites) {
    const name = padRight(s.name, 24);
    const service = padRight("SW-COMM-2YD", 14);
    const address = padRight(s.address, 30);
    const route = padRight("RT-DET-001", 8);
    const zone = padRight("A1", 6);
    const contact = padRight(s.customerId, 14);
    lines.push(name + service + address + route + zone + contact);
  }
  return lines.join("\n") + "\n";
}

function main(): void {
  const dataset = generateDataset();
  console.log(`Generated ${dataset.total} records (hash ${dataset.total}):`);
  console.log(`  customers:   ${dataset.customers.length}`);
  console.log(`  sites:       ${dataset.sites.length}`);
  console.log(`  containers:  ${dataset.containers.length}`);
  console.log(`  agreements:  ${dataset.agreements.length}`);
  console.log(`  routes:      ${dataset.routes.length}`);
  console.log(`  tickets:     ${dataset.tickets.length}`);

  mkdirSync(OUT_DIR, { recursive: true });

  const files: Array<[string, string]> = [
    ["routepro_2019_export.csv", buildRouteProCsv(dataset)],
    ["quickbooks_customer_export.tsv", buildQuickBooksCsv(dataset)],
    ["transfer_station_weights.xlsx", buildTransferSpreadsheet(dataset)],
    ["legacy_paper_export.tab", buildLegacyExport(dataset)],
  ];

  for (const [name, content] of files) {
    const path = join(OUT_DIR, name);
    writeFileSync(path, content, "utf8");
    console.log(`  wrote ${path} (${content.length.toLocaleString()} bytes)`);
  }

  console.log("\nDone. Upload these 4 files in the demo's file-drop view.");
}

main();

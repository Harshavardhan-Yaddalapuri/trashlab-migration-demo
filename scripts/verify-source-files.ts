/**
 * Verify the exported source files parse correctly with the real intake parsers.
 * Run with: npx tsx scripts/verify-source-files.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRouteProCsv, parseQuickBooksExport, parseTransferSpreadsheet, parseLegacyExport } from "../src/pipeline/agents/intake-formats";

const OUT_DIR = join(process.cwd(), "sample-data");

function main(): void {
  const routepro = readFileSync(join(OUT_DIR, "routepro_2019_export.csv"), "utf8");
  const quickbooks = readFileSync(join(OUT_DIR, "quickbooks_customer_export.tsv"), "utf8");
  const transfer = readFileSync(join(OUT_DIR, "transfer_station_weights.xlsx"), "utf8");
  const legacy = readFileSync(join(OUT_DIR, "legacy_paper_export.tab"), "utf8");

  const rp = parseRouteProCsv(routepro);
  const qb = parseQuickBooksExport(quickbooks);
  const ts = parseTransferSpreadsheet(transfer);
  const lg = parseLegacyExport(legacy);

  console.log("RoutePro CSV:", rp.rows.length, "rows,", rp.rows.filter((r) => r.error).length, "errors");
  console.log("QuickBooks:", qb.rows.length, "rows,", qb.rows.filter((r) => r.error).length, "errors");
  console.log("Transfer:", ts.rows.length, "rows,", ts.rows.filter((r) => r.error).length, "errors");
  console.log("Legacy:", lg.rows.length, "rows,", lg.rows.filter((r) => r.error).length, "errors");

  const total = rp.rows.length + qb.rows.length + ts.rows.length + lg.rows.length;
  console.log("TOTAL parsed rows:", total);

  // Show a sample row from each
  console.log("\nSample RoutePro row:", JSON.stringify(rp.rows[0]?.values));
  console.log("Sample QuickBooks row:", JSON.stringify(qb.rows[0]?.values));
  console.log("Sample Transfer row:", JSON.stringify(ts.rows[0]?.values));
  console.log("Sample Legacy row:", JSON.stringify(lg.rows[0]?.values));
}

main();

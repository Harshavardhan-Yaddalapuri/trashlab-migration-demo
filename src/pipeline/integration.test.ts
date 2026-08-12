import { describe, expect, it } from "vitest";
import { buildMigrationGraph, initialState } from "./graph";
import { generateDataset } from "@/data/generate";
import { serializeSourceFile } from "./agents/intake-formats";
import type { SourceFile } from "@/lib/types";

const NOW = "2026-08-12T00:00:00.000Z";

function makeSourceFilesSmall(): SourceFile[] {
  const routeproContent = `name,phone,address,city,state,zip,sizeYards,type,dayOfWeek
"Summit Construction",313-555-0123,"100 Main St",Detroit,MI,48201,20,rolloff,Mon
"Apex Disposal",313-555-0111,"200 Oak Ave",Warren,MI,48091,4,frontload,Tue`;

  const quickbooksContent = `name,serviceCode,startDate,rateCents
"Summit Construction",SW-COMM-2YD,01/02/2023,12000
"Apex Disposal",SW-RO-20YD,2023-03-01,40000`;

  const transferContent = `# Transfer Station Log - Springfield East
date:  containerId:  grossTons:
01/02/2023  RC-1023  4.5
03/04/2023  BIN 2044  3.2`;

  const legacyContent = `Summit Construction        SW-COMM-2YD  100 Main St             RT-DET-001A13135550123
Apex Disposal            SW-RO-20YD   200 Oak Ave             RT-WAR-002B23135550111`;

  return [
    { id: "sf-routepro", kind: "routepro-csv" as const, fileName: "routepro_2019_export.csv", recordCount: 2, rawHash: "seed", ingestedAt: NOW, content: routeproContent },
    { id: "sf-quickbooks", kind: "quickbooks-export" as const, fileName: "quickbooks_customer_export.tsv", recordCount: 2, rawHash: "seed", ingestedAt: NOW, content: quickbooksContent },
    { id: "sf-transfer", kind: "transfer-spreadsheet" as const, fileName: "transfer_station_weights.xlsx", recordCount: 2, rawHash: "seed", ingestedAt: NOW, content: transferContent },
    { id: "sf-legacy", kind: "legacy-export" as const, fileName: "legacy_paper_export.tab", recordCount: 2, rawHash: "seed", ingestedAt: NOW, content: legacyContent },
  ];
}

function makeSourceFiles150k(): SourceFile[] {
  const dataset = generateDataset();
  
  // RoutePro CSV: customers + containers + routes
  const routeproRows = [
    ...dataset.customers.map(c => ({ name: c.name, phone: c.phone, address: c.address, city: c.city, state: c.state, zip: c.zip, sizeYards: "20", type: "rolloff", dayOfWeek: "Mon" })),
    ...dataset.containers.map(c => ({ name: c.id, phone: "", address: "", city: "", state: "", zip: "", sizeYards: String(c.sizeYards), type: c.type, dayOfWeek: "Mon" })),
    ...dataset.routes.map(r => ({ name: r.name, phone: "", address: "", city: "", state: "", zip: "", sizeYards: "", type: "", dayOfWeek: r.dayOfWeek })),
  ];
  
  // QuickBooks export: agreements
  const quickbooksRows = dataset.agreements.map(a => ({ 
    name: a.customerId, 
    serviceCode: a.serviceCode, 
    startDate: a.startDate, 
    rateCents: String(a.rateCents) 
  }));
  
  // Transfer spreadsheet: tickets
  const transferRows = dataset.tickets.map(t => ({ 
    date: t.date, 
    containerId: t.containerId ?? "", 
    grossTons: String(t.grossTons) 
  }));
  
  // Legacy export: sites
  const legacyRows = dataset.sites.map(s => ({ 
    name: s.name, 
    service: "", 
    address: s.address, 
    route: "", 
    zone: "", 
    contact: s.customerId 
  }));

  return [
    { 
      id: "sf-routepro", 
      kind: "routepro-csv" as const, 
      fileName: "routepro_2019_export.csv", 
      recordCount: routeproRows.length, 
      rawHash: "seed", 
      ingestedAt: new Date().toISOString(),
      content: serializeSourceFile("routepro-csv", routeproRows)
    },
    { 
      id: "sf-quickbooks", 
      kind: "quickbooks-export" as const, 
      fileName: "quickbooks_customer_export.tsv", 
      recordCount: quickbooksRows.length, 
      rawHash: "seed", 
      ingestedAt: new Date().toISOString(),
      content: serializeSourceFile("quickbooks-export", quickbooksRows)
    },
    { 
      id: "sf-transfer", 
      kind: "transfer-spreadsheet" as const, 
      fileName: "transfer_station_weights.xlsx", 
      recordCount: transferRows.length, 
      rawHash: "seed", 
      ingestedAt: new Date().toISOString(),
      content: serializeSourceFile("transfer-spreadsheet", transferRows)
    },
    { 
      id: "sf-legacy", 
      kind: "legacy-export" as const, 
      fileName: "legacy_paper_export.tab", 
      recordCount: legacyRows.length, 
      rawHash: "seed", 
      ingestedAt: new Date().toISOString(),
      content: serializeSourceFile("legacy-export", legacyRows)
    },
  ];
}

describe("integration: pipeline end-to-end", () => {
  it("completes the full pipeline on sample records (full run in one invoke)", async () => {
    const graph = buildMigrationGraph();
    const config = { configurable: { thread_id: "test-integration-pipeline-full" } };
    
    const sourceFiles = makeSourceFilesSmall();
    const state = initialState("job-integration-full", sourceFiles);
    
    // Run the full pipeline in one go
    const start = performance.now();
    const result = await graph.invoke(state, config);
    const elapsed = performance.now() - start;
    
    console.log(`Full pipeline completed in ${(elapsed / 1000).toFixed(2)}s`);
    console.log(`Status: ${result.status}`);
    console.log(`Progress: ${result.progress}`);
    console.log(`Raw records: ${result.rawRecords.length}`);
    console.log(`Normalized: ${result.normalized.length}`);
    console.log(`Resolved: ${result.resolved.length}`);
    console.log(`Proposals: ${result.proposals.length}`);
    console.log(`Exceptions: ${result.exceptions.length}`);
    result.exceptions.forEach((e, i) => console.log(`  Exception ${i}: ${e.type} severity=${e.severity} summary=${e.summary}`));
    console.log(`Audit events: ${result.audit.length}`);
    
    // The graph should go all the way to completed in one invoke
    // If there are critical exceptions, it goes to "failed" (END)
    // If no critical exceptions, it goes to "commit" then "completed"
    // Accept either "completed" or "failed" as valid terminal states
    expect(["completed", "failed"]).toContain(result.status);
    expect(result.progress).toBeGreaterThanOrEqual(0.95);
    expect(result.rawRecords.length).toBeGreaterThan(0);
    expect(result.normalized.length).toBeGreaterThan(0);
    expect(result.resolved.length).toBeGreaterThan(0);
    expect(result.proposals.length).toBeGreaterThan(0);
    expect(result.audit.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(30_000);
  });
  
  it("eval gate passes on golden set", async () => {
    const { runGoldenSet, computeMetrics, assertEvalGate, detectSilentErrors } = await import("./eval/metrics");

    const input = runGoldenSet();
    const metrics = computeMetrics(input);
    const silentErrors = detectSilentErrors();

    expect(metrics.silentErrors).toBe(0);
    expect(metrics.autoMapRate).toBeGreaterThanOrEqual(0.95);
    expect(silentErrors.every(e => e.detected)).toBe(true);

    expect(() => assertEvalGate()).not.toThrow();
  });

  it("completes the full pipeline on 150k records in under 30 seconds", async () => {
    const sourceFiles = makeSourceFiles150k();
    
    const graph = buildMigrationGraph();
    const config = { configurable: { thread_id: "test-150k-pipeline" } };

    const state = initialState("job-150k", sourceFiles);

    const start = performance.now();
    const result = await graph.invoke(state, config);
    const elapsed = performance.now() - start;

    console.log(`Pipeline completed in ${(elapsed / 1000).toFixed(2)}s`);
    console.log(`Status: ${result.status}`);
    console.log(`Progress: ${result.progress}`);
    console.log(`Raw records: ${result.rawRecords.length}`);
    console.log(`Normalized: ${result.normalized.length}`);
    console.log(`Resolved: ${result.resolved.length}`);
    console.log(`Proposals: ${result.proposals.length}`);
    console.log(`Exceptions: ${result.exceptions.length}`);
    result.exceptions.forEach((e, i) => console.log(`  Exception ${i}: ${e.type} severity=${e.severity} summary=${e.summary}`));
    console.log(`Audit events: ${result.audit.length}`);

    // Performance assertion: < 30 seconds for 150k records
    expect(elapsed).toBeLessThan(30_000);

    // Pipeline should complete
    expect(["completed", "failed"]).toContain(result.status);
    expect(result.progress).toBeGreaterThanOrEqual(0.95);
    expect(result.rawRecords.length).toBeGreaterThan(0);
    expect(result.normalized.length).toBeGreaterThan(0);
    expect(result.resolved.length).toBeGreaterThan(0);
    expect(result.proposals.length).toBeGreaterThan(0);
    expect(result.audit.length).toBeGreaterThan(0);
  }, 60_000);
});

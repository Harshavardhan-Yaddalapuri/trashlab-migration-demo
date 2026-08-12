import { describe, expect, it } from "vitest";
import { intakeAgent } from "./intake-agent";
import {
  parseCsvLine,
  parseLegacyExport,
  parseQuickBooksExport,
  parseRouteProCsv,
  parseTransferSpreadsheet,
  serializeSourceFile,
  splitOutsideQuotes,
} from "./intake-formats";
import type { SourceFile } from "@/lib/types";

const NOW = "2026-08-12T00:00:00.000Z";

function ctx() {
  return { jobId: "job-1", tenantId: "demo", now: () => NOW };
}

function sourceFile(
  id: string,
  kind: SourceFile["kind"],
  content: string,
): SourceFile {
  return {
    id,
    kind,
    fileName: `${id}.txt`,
    recordCount: 0,
    rawHash: "seed",
    ingestedAt: NOW,
    content,
  };
}

// ---------------------------------------------------------------------------
// CSV / field-parsing primitives
// ---------------------------------------------------------------------------

describe("csv parsing primitives", () => {
  it("parses quoted csv fields with embedded commas and quotes", () => {
    expect(parseCsvLine('"Summit, LLC",313-555-0123,"said ""hi"""')).toEqual([
      "Summit, LLC",
      "313-555-0123",
      'said "hi"',
    ]);
  });

  it("splits on a delimiter outside double quotes", () => {
    expect(splitOutsideQuotes('a "b c" d', " ")).toEqual(["a", "b c", "d"]);
  });
});

// ---------------------------------------------------------------------------
// RoutePro CSV
// ---------------------------------------------------------------------------

const ROUTEPRO_CSV = [
  "name,phone,address,city,state,zip,sizeYards,type,dayOfWeek",
  '"Summit, LLC",(313) 555-0100,"123 Main St",Detroit,MI,48201,20,rolloff,Mon',
  "Apex Disposal,313-555-0111,456 Oak Ave,Warren,MI,48091,4,frontload,",
  "Bad Row",
  "",
].join("\n");

describe("intake: routepro-csv format", () => {
  it("parses valid rows and preserves raw values", async () => {
    const result = await intakeAgent.run(ctx(), [
      sourceFile("sf-rp", "routepro-csv", ROUTEPRO_CSV),
    ]);
    expect(result.rawRecords).toHaveLength(2);
    expect(result.parseErrors).toHaveLength(1);

    const first = result.rawRecords[0];
    expect(first.sourceRow).toBe(1);
    expect(first.payload["name"]).toBe("Summit, LLC");
    // Raw values untouched: the phone is NOT normalized at intake.
    expect(first.payload["phone"]).toBe("(313) 555-0100");
    expect(first.payload["sizeYards"]).toBe("20");
  });

  it("quarantines malformed rows instead of dropping them", async () => {
    const result = await intakeAgent.run(ctx(), [
      sourceFile("sf-rp2", "routepro-csv", ROUTEPRO_CSV),
    ]);
    const error = result.parseErrors[0];
    expect(error).toBeDefined();
    expect(error.row).toBe(3);
    expect(error.message).toContain("expected");
    // Quarantined row count matches the record counts kept.
    expect(result.rawRecords.length + result.parseErrors.length).toBe(2 + 1);
  });

  it("handles CRLF line endings identically", async () => {
    const crlf = ROUTEPRO_CSV.replace(/\n/g, "\r\n");
    const a = await intakeAgent.run(ctx(), [sourceFile("s1", "routepro-csv", ROUTEPRO_CSV)]);
    const b = await intakeAgent.run(ctx(), [sourceFile("s2", "routepro-csv", crlf)]);
    expect(b.rawRecords).toHaveLength(a.rawRecords.length);
    expect(b.rawRecords[0].payload).toEqual(a.rawRecords[0].payload);
  });

  it("parses a header-only file with zero records and zero errors", async () => {
    const result = await intakeAgent.run(ctx(), [
      sourceFile("sf-headonly", "routepro-csv", "name,phone\n"),
    ]);
    expect(result.rawRecords).toHaveLength(0);
    expect(result.parseErrors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// QuickBooks export
// ---------------------------------------------------------------------------

const QUICKBOOKS_CSV = [
  'name,service,startDate,rateCents',
  '"Blue Hauling",SW-COMM-2YD,01/02/2023,120.50',
  "Total 2",
  "Report Generated 2026",
  "Green Disposal,SW-RO-20YD,2023-03-01,400.00",
].join("\n");

describe("intake: quickbooks-export format", () => {
  it("parses data rows and skips summary footer rows", async () => {
    const result = await intakeAgent.run(ctx(), [
      sourceFile("sf-qb", "quickbooks-export", QUICKBOOKS_CSV),
    ]);
    expect(result.rawRecords).toHaveLength(2);
    expect(result.parseErrors).toHaveLength(0);
    expect(result.rawRecords[0].payload["name"]).toBe("Blue Hauling");
    expect(result.rawRecords[1].payload["rateCents"]).toBe("400.00");
  });

  it("quarantines short rows with a row-specific message", async () => {
    const result = await intakeAgent.run(ctx(), [
      sourceFile("sf-qb2", "quickbooks-export", "a,b\n1\n"),
    ]);
    expect(result.parseErrors[0]?.row).toBe(1);
    expect(result.parseErrors[0]?.message).toContain("expected 2 columns");
  });
});

// ---------------------------------------------------------------------------
// Transfer-station spreadsheet
// ---------------------------------------------------------------------------

const TRANSFER_SPREADSHEET = [
  "# Transfer Station Log - Springfield East",
  "date:  containerId:  grossTons:",
  "01/02/2023  RC-1023  4.5",
  "03/04/2023  BIN 2044  3.2",
  "short",
  "",
].join("\n");

describe("intake: transfer-spreadsheet format", () => {
  it("parses whitespace-aligned columns and ignores comments", async () => {
    const result = await intakeAgent.run(ctx(), [
      sourceFile("sf-ts", "transfer-spreadsheet", TRANSFER_SPREADSHEET),
    ]);
    expect(result.rawRecords).toHaveLength(2);
    expect(result.rawRecords[0].payload["containerId"]).toBe("RC-1023");
    expect(result.rawRecords[1].payload["grossTons"]).toBe("3.2");
  });

  it("quarantines rows with too few columns", async () => {
    const result = await intakeAgent.run(ctx(), [
      sourceFile("sf-ts2", "transfer-spreadsheet", TRANSFER_SPREADSHEET),
    ]);
    expect(result.parseErrors[0]?.row).toBe(5);
    expect(result.parseErrors[0]?.message).toContain("got 1");
  });
});

// ---------------------------------------------------------------------------
// Paper-era legacy export
// ---------------------------------------------------------------------------

const LEGACY_EXPORT = [
  ...serializeSourceFile("legacy-export", [
    { name: "Summit Disposal", service: "SW-RO-20YD", address: "123 Main St", route: "R-01", zone: "A1", contact: "3135550100" },
    { name: "Apex Waste", service: "SW-COMM-2YD", address: "456 Oak Ave", route: "R-02", zone: "B2", contact: "3135550111" },
  ])
    .split("\n")
    .filter((line) => line !== ""),
  "Bad Record That Exceeds The Fixed Width Layout Entirely On Purpose And Then Some More Words To Push Past Ninety Six Characters",
].join("\n");

describe("intake: legacy-export format", () => {
  it("parses fixed-width rows with the documented layout", async () => {
    const result = await intakeAgent.run(ctx(), [
      sourceFile("sf-lg", "legacy-export", LEGACY_EXPORT),
    ]);
    expect(result.rawRecords).toHaveLength(2);
    expect(result.rawRecords[0].payload["name"]).toBe("Summit Disposal");
    expect(result.rawRecords[0].payload["service"]).toBe("SW-RO-20YD");
    expect(result.rawRecords[0].payload["route"]).toBe("R-01");
    expect(result.rawRecords[0].payload["zone"]).toBe("A1");
    expect(result.rawRecords[0].payload["contact"]).toBe("3135550100");
  });

  it("quarantines rows exceeding the fixed-width layout", async () => {
    const result = await intakeAgent.run(ctx(), [
      sourceFile("sf-lg2", "legacy-export", LEGACY_EXPORT),
    ]);
    expect(result.parseErrors[0]?.row).toBe(4);
    expect(result.parseErrors[0]?.message).toContain("exceeds");
  });
});

// ---------------------------------------------------------------------------
// Serializer / metadata handling
// ---------------------------------------------------------------------------

describe("intake: source metadata handling", () => {
  it("reports a file with no content instead of crashing", async () => {
    const result = await intakeAgent.run(ctx(), [
      sourceFile("sf-empty", "routepro-csv", ""),
    ]);
    expect(result.rawRecords).toHaveLength(0);
    expect(result.parseErrors[0]?.message).toBe("source file has no content to parse");
  });

  it("serializer output round-trips through the parser", () => {
    const rows = [
      { name: "Summit, LLC", phone: "313-555-0100" },
      { name: "Apex Disposal", phone: "(313) 555-0111" },
    ];
    for (const kind of ["routepro-csv", "quickbooks-export", "transfer-spreadsheet"] as const) {
      const serialized = serializeSourceFile(kind, rows);
      const parsed =
        kind === "routepro-csv"
          ? parseRouteProCsv(serialized)
          : kind === "quickbooks-export"
            ? parseQuickBooksExport(serialized)
            : parseTransferSpreadsheet(serialized);
      expect(parsed.rows).toHaveLength(2);
      expect(parsed.rows[0].values["name"]).toBe("Summit, LLC");
      expect(parsed.rows[0].error).toBeUndefined();
    }
  });

  it("legacy serializer produces the fixed-width layout", () => {
    const serialized = serializeSourceFile("legacy-export", [
      { name: "Summit Disposal", service: "SW-RO-20YD", address: "123 Main St", route: "R-01", zone: "A1", contact: "3135550100" },
    ]);
    expect(serialized.split("\n")[1]).toHaveLength(96);
    const parsed = parseLegacyExport(serialized);
    expect(parsed.rows[0].values["contact"]).toBe("3135550100");
  });

  it("intake keeps raw payload bytes untouched", async () => {
    const result = await intakeAgent.run(ctx(), [
      sourceFile("sf-raw", "routepro-csv", "name,phone\n\"Weird , Name\",  (313) 555-0100 \n"),
    ]);
    expect(result.rawRecords[0].payload["name"]).toBe("Weird , Name");
    expect(result.rawRecords[0].payload["phone"]).toBe("(313) 555-0100");
  });
});

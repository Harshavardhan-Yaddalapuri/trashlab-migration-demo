import { describe, expect, it } from "vitest";
import {
  buildConfidenceHistogram,
  computeEntityBreakdown,
  computeReport,
  computeSourceBreakdown,
  entityBreakdownToCsv,
  escapeCsvField,
  fullReportCsv,
  histogramToCsv,
  reportSummaryToCsv,
  sourceBreakdownToCsv,
  toCsv,
} from "./compute";
import type { ReportInput } from "./types";

function makeInput(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    jobId: "job-1",
    totalRecords: 150_000,
    autoMapped: 148_800,
    exceptionCount: 1_200,
    silentErrors: 0,
    goLiveDays: 2,
    confidences: Array(148_800).fill(0.95).concat(Array(1_200).fill(0.5)),
    sources: [
      { source: "routepro-csv", totalRecords: 60_000, autoMapped: 59_500, exceptions: 500 },
      { source: "quickbooks-export", totalRecords: 40_000, autoMapped: 39_700, exceptions: 300 },
      { source: "transfer-spreadsheet", totalRecords: 30_000, autoMapped: 29_800, exceptions: 200 },
      { source: "legacy-export", totalRecords: 20_000, autoMapped: 19_800, exceptions: 200 },
    ],
    entities: [
      { entityType: "customer", totalRecords: 45_000, autoMapped: 44_600, exceptions: 400, confidenceSum: 42_750, confidenceCount: 45_000 },
      { entityType: "site", totalRecords: 35_000, autoMapped: 34_700, exceptions: 300, confidenceSum: 33_250, confidenceCount: 35_000 },
      { entityType: "container", totalRecords: 40_000, autoMapped: 39_700, exceptions: 300, confidenceSum: 38_000, confidenceCount: 40_000 },
      { entityType: "agreement", totalRecords: 18_000, autoMapped: 17_800, exceptions: 200, confidenceSum: 17_100, confidenceCount: 18_000 },
      { entityType: "route", totalRecords: 7_000, autoMapped: 7_000, exceptions: 0, confidenceSum: 6_650, confidenceCount: 7_000 },
      { entityType: "ticket", totalRecords: 5_000, autoMapped: 5_000, exceptions: 0, confidenceSum: 4_750, confidenceCount: 5_000 },
    ],
    ...overrides,
  };
}

// ─── computeReport ────────────────────────────────────────────────────

describe("computeReport", () => {
  it("computes auto-map rate correctly", () => {
    const input = makeInput({ totalRecords: 150_000, autoMapped: 148_800 });
    const report = computeReport(input);

    expect(report.autoMapRate).toBeCloseTo(0.992, 3);
    expect(report.autoMapped).toBe(148_800);
  });

  it("computes exception rate correctly", () => {
    const input = makeInput({ totalRecords: 150_000, exceptionCount: 1_200 });
    const report = computeReport(input);

    expect(report.exceptionRate).toBeCloseTo(0.008, 3);
  });

  it("handles zero records without division by zero", () => {
    const input = makeInput({
      totalRecords: 0,
      autoMapped: 0,
      exceptionCount: 0,
      confidences: [],
      sources: [],
      entities: [],
    });

    const report = computeReport(input);

    expect(report.autoMapRate).toBe(0);
    expect(report.exceptionRate).toBe(0);
    expect(report.confidenceHistogram.every((b) => b.count === 0)).toBe(true);
  });

  it("includes all required fields", () => {
    const input = makeInput();
    const report = computeReport(input);

    expect(report.jobId).toBe("job-1");
    expect(report.generatedAt).toBeDefined();
    expect(report.totalRecords).toBe(150_000);
    expect(report.silentErrors).toBe(0);
    expect(report.goLiveDays).toBe(2);
    expect(report.bySource).toHaveLength(4);
    expect(report.byEntity).toHaveLength(6);
    expect(report.confidenceHistogram).toHaveLength(10);
  });

  it("report numbers match the demo script targets", () => {
    const input = makeInput();
    const report = computeReport(input);

    // Demo script: 2 days, 99.2% auto-mapped, 0 silent errors
    expect(report.goLiveDays).toBe(2);
    expect(report.autoMapRate).toBeCloseTo(0.992, 3);
    expect(report.silentErrors).toBe(0);
  });
});

// ─── buildConfidenceHistogram ─────────────────────────────────────────

describe("buildConfidenceHistogram", () => {
  it("builds 10 buckets", () => {
    const confidences = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95];
    const histogram = buildConfidenceHistogram(confidences);

    expect(histogram).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(histogram[i].count).toBe(1);
      expect(histogram[i].percentage).toBeCloseTo(0.1, 1);
    }
  });

  it("handles empty array", () => {
    const histogram = buildConfidenceHistogram([]);
    expect(histogram).toHaveLength(10);
    expect(histogram.every((b) => b.count === 0)).toBe(true);
    expect(histogram.every((b) => b.percentage === 0)).toBe(true);
  });

  it("clamps confidence to [0, 1] range via bucket index", () => {
    // Math.max(0, Math.min(9, ...)) ensures clamping
    const confidences = [0, 0.5, 1.0];
    const histogram = buildConfidenceHistogram(confidences);

    // 0 → bucket 0, 0.5 → bucket 5, 1.0 → bucket 9
    expect(histogram[0].count).toBe(1);
    expect(histogram[5].count).toBe(1);
    expect(histogram[9].count).toBe(1);
  });
});

// ─── source breakdown ─────────────────────────────────────────────────

describe("computeSourceBreakdown", () => {
  it("computes per-source auto-map rates", () => {
    const sources = [
      { source: "routepro-csv", totalRecords: 100, autoMapped: 95, exceptions: 5 },
      { source: "quickbooks-export", totalRecords: 50, autoMapped: 48, exceptions: 2 },
    ];

    const breakdown = computeSourceBreakdown(sources);

    expect(breakdown[0].autoMapRate).toBeCloseTo(0.95, 2);
    expect(breakdown[1].autoMapRate).toBeCloseTo(0.96, 2);
  });

  it("handles zero-record sources", () => {
    const sources = [{ source: "empty", totalRecords: 0, autoMapped: 0, exceptions: 0 }];
    const breakdown = computeSourceBreakdown(sources);

    expect(breakdown[0].autoMapRate).toBe(0);
  });
});

// ─── entity breakdown ─────────────────────────────────────────────────

describe("computeEntityBreakdown", () => {
  it("computes per-entity metrics", () => {
    const entities = [
      { entityType: "customer", totalRecords: 100, autoMapped: 90, exceptions: 10, confidenceSum: 85, confidenceCount: 100 },
    ];

    const breakdown = computeEntityBreakdown(entities);

    expect(breakdown[0].autoMapRate).toBeCloseTo(0.9, 1);
    expect(breakdown[0].avgConfidence).toBeCloseTo(0.85, 2);
  });

  it("handles zero confidence count", () => {
    const entities = [
      { entityType: "customer", totalRecords: 0, autoMapped: 0, exceptions: 0, confidenceSum: 0, confidenceCount: 0 },
    ];

    const breakdown = computeEntityBreakdown(entities);

    expect(breakdown[0].avgConfidence).toBe(0);
  });
});

// ─── CSV export ───────────────────────────────────────────────────────

describe("escapeCsvField", () => {
  it("wraps fields with commas in quotes", () => {
    expect(escapeCsvField("hello, world")).toBe('"hello, world"');
  });

  it("wraps fields with quotes in quotes and escapes inner quotes", () => {
    expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
  });

  it("wraps fields with newlines in quotes", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("does not wrap simple fields", () => {
    expect(escapeCsvField("simple")).toBe("simple");
  });
});

describe("toCsv", () => {
  it("converts rows to CSV with header", () => {
    const rows = [
      { name: "Alice", role: "owner" },
      { name: "Bob", role: "dispatcher" },
    ];

    const csv = toCsv(rows);

    expect(csv).toBe("name,role\nAlice,owner\nBob,dispatcher\n");
  });

  it("returns empty string for empty rows", () => {
    expect(toCsv([])).toBe("");
  });

  it("handles missing fields", () => {
    const rows = [{ a: "1" }, { a: "2", b: "extra" }];
    const csv = toCsv(rows);

    // Header from first row keys only
    expect(csv).toBe("a\n1\n2\n");
  });
});

describe("reportSummaryToCsv", () => {
  it("produces valid CSV with summary metrics", () => {
    const input = makeInput();
    const report = computeReport(input);
    const csv = reportSummaryToCsv(report);

    expect(csv).toContain("metric,value");
    expect(csv).toContain("Auto-Map Rate");
    expect(csv).toContain("99.2%");
    expect(csv).toContain("Silent Errors,0");
    expect(csv).toContain("Go-Live (days),2");
  });
});

describe("sourceBreakdownToCsv", () => {
  it("produces valid CSV with source breakdown", () => {
    const input = makeInput();
    const report = computeReport(input);
    const csv = sourceBreakdownToCsv(report);

    expect(csv).toContain("source,totalRecords,autoMapped,exceptions,autoMapRate");
    expect(csv).toContain("routepro-csv");
  });
});

describe("entityBreakdownToCsv", () => {
  it("produces valid CSV with entity breakdown", () => {
    const input = makeInput();
    const report = computeReport(input);
    const csv = entityBreakdownToCsv(report);

    expect(csv).toContain("entityType,totalRecords,autoMapped,exceptions,autoMapRate,avgConfidence");
    expect(csv).toContain("customer");
  });
});

describe("histogramToCsv", () => {
  it("produces valid CSV with histogram", () => {
    const input = makeInput();
    const report = computeReport(input);
    const csv = histogramToCsv(report);

    expect(csv).toContain("range,count,percentage");
    expect(csv).toContain("0.9-1.0");
  });
});

describe("fullReportCsv", () => {
  it("produces a multi-section CSV", () => {
    const input = makeInput();
    const report = computeReport(input);
    const csv = fullReportCsv(report);

    expect(csv).toContain("# Summary");
    expect(csv).toContain("# By Source");
    expect(csv).toContain("# By Entity Type");
    expect(csv).toContain("# Confidence Histogram");
    expect(csv).toContain("99.2%");
  });
});

// ─── edge cases ───────────────────────────────────────────────────────

describe("edge cases", () => {
  it("report with 100% auto-map rate", () => {
    const input = makeInput({
      totalRecords: 100,
      autoMapped: 100,
      exceptionCount: 0,
      confidences: Array(100).fill(0.99),
      sources: [{ source: "routepro-csv", totalRecords: 100, autoMapped: 100, exceptions: 0 }],
      entities: [{ entityType: "customer", totalRecords: 100, autoMapped: 100, exceptions: 0, confidenceSum: 99, confidenceCount: 100 }],
    });

    const report = computeReport(input);

    expect(report.autoMapRate).toBe(1);
    expect(report.exceptionRate).toBe(0);
    expect(report.silentErrors).toBe(0);
  });

  it("report with silent errors detected", () => {
    const input = makeInput({ silentErrors: 3 });
    const report = computeReport(input);

    expect(report.silentErrors).toBe(3);
  });

  it("CSV handles special characters in values", () => {
    const rows = [
      { name: "Summit Construction, LLC", role: "owner" },
    ];

    const csv = toCsv(rows);
    expect(csv).toBe('name,role\n"Summit Construction, LLC",owner\n');
  });
});

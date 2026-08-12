/**
 * Report computation. Builds the migration report from pipeline output,
 * including metrics, breakdowns, confidence histogram, and CSV export.
 */

import type {
  ConfidenceBucket,
  CsvRow,
  EntityBreakdown,
  MigrationReport,
  ReportInput,
  SourceBreakdown,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Report computation ──────────────────────────────────────────────

/**
 * Build a confidence histogram from an array of confidence values.
 * 10 buckets: 0.0-0.1, 0.1-0.2, ..., 0.9-1.0.
 */
export function buildConfidenceHistogram(confidences: number[]): ConfidenceBucket[] {
  const buckets = Array(10).fill(0);

  for (const c of confidences) {
    const idx = Math.min(9, Math.floor(c * 10));
    buckets[idx]++;
  }

  const total = confidences.length;

  return buckets.map((count, i) => ({
    range: `${(i * 0.1).toFixed(1)}-${((i + 1) * 0.1).toFixed(1)}`,
    count,
    percentage: total === 0 ? 0 : count / total,
  }));
}

/**
 * Compute per-source breakdown.
 */
export function computeSourceBreakdown(
  sources: ReportInput["sources"],
): SourceBreakdown[] {
  return sources.map((s) => ({
    source: s.source,
    totalRecords: s.totalRecords,
    autoMapped: s.autoMapped,
    exceptions: s.exceptions,
    autoMapRate: s.totalRecords === 0 ? 0 : s.autoMapped / s.totalRecords,
  }));
}

/**
 * Compute per-entity-type breakdown.
 */
export function computeEntityBreakdown(
  entities: ReportInput["entities"],
): EntityBreakdown[] {
  return entities.map((e) => ({
    entityType: e.entityType,
    totalRecords: e.totalRecords,
    autoMapped: e.autoMapped,
    exceptions: e.exceptions,
    autoMapRate: e.totalRecords === 0 ? 0 : e.autoMapped / e.totalRecords,
    avgConfidence: e.confidenceCount === 0 ? 0 : e.confidenceSum / e.confidenceCount,
  }));
}

/**
 * Compute the full migration report from pipeline output.
 */
export function computeReport(input: ReportInput): MigrationReport {
  const autoMapRate = input.totalRecords === 0 ? 0 : input.autoMapped / input.totalRecords;
  const exceptionRate = input.totalRecords === 0 ? 0 : input.exceptionCount / input.totalRecords;

  return {
    jobId: input.jobId,
    generatedAt: nowIso(),
    totalRecords: input.totalRecords,
    autoMapped: input.autoMapped,
    exceptionCount: input.exceptionCount,
    autoMapRate,
    exceptionRate,
    silentErrors: input.silentErrors,
    goLiveDays: input.goLiveDays,
    confidenceHistogram: buildConfidenceHistogram(input.confidences),
    bySource: computeSourceBreakdown(input.sources),
    byEntity: computeEntityBreakdown(input.entities),
  };
}

// ─── CSV export ──────────────────────────────────────────────────────

/**
 * Escape a CSV field. Wraps in quotes if the value contains commas,
 * quotes, or newlines.
 */
export function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert an array of objects to a CSV string.
 * First row is the header (keys of the first object).
 */
export function toCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(escapeCsvField).join(",");

  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvField(row[h] ?? "")).join(","),
  );

  return [headerLine, ...dataLines].join("\n") + "\n";
}

/**
 * Export the report summary as CSV rows.
 */
export function reportSummaryToCsv(report: MigrationReport): string {
  const rows: CsvRow[] = [
    { metric: "Job ID", value: report.jobId },
    { metric: "Generated At", value: report.generatedAt },
    { metric: "Total Records", value: report.totalRecords.toLocaleString() },
    { metric: "Auto-Mapped", value: report.autoMapped.toLocaleString() },
    { metric: "Exceptions", value: report.exceptionCount.toLocaleString() },
    { metric: "Auto-Map Rate", value: `${(report.autoMapRate * 100).toFixed(1)}%` },
    { metric: "Exception Rate", value: `${(report.exceptionRate * 100).toFixed(1)}%` },
    { metric: "Silent Errors", value: String(report.silentErrors) },
    { metric: "Go-Live (days)", value: String(report.goLiveDays) },
  ];

  return toCsv(rows);
}

/**
 * Export the source breakdown as CSV rows.
 */
export function sourceBreakdownToCsv(report: MigrationReport): string {
  const rows: CsvRow[] = report.bySource.map((s) => ({
    source: s.source,
    totalRecords: String(s.totalRecords),
    autoMapped: String(s.autoMapped),
    exceptions: String(s.exceptions),
    autoMapRate: `${(s.autoMapRate * 100).toFixed(1)}%`,
  }));

  return toCsv(rows);
}

/**
 * Export the entity breakdown as CSV rows.
 */
export function entityBreakdownToCsv(report: MigrationReport): string {
  const rows: CsvRow[] = report.byEntity.map((e) => ({
    entityType: e.entityType,
    totalRecords: String(e.totalRecords),
    autoMapped: String(e.autoMapped),
    exceptions: String(e.exceptions),
    autoMapRate: `${(e.autoMapRate * 100).toFixed(1)}%`,
    avgConfidence: `${(e.avgConfidence * 100).toFixed(1)}%`,
  }));

  return toCsv(rows);
}

/**
 * Export the confidence histogram as CSV rows.
 */
export function histogramToCsv(report: MigrationReport): string {
  const rows: CsvRow[] = report.confidenceHistogram.map((b) => ({
    range: b.range,
    count: String(b.count),
    percentage: `${(b.percentage * 100).toFixed(1)}%`,
  }));

  return toCsv(rows);
}

/**
 * Export the full report as a multi-section CSV.
 * Sections are separated by blank lines with a section header.
 */
export function fullReportCsv(report: MigrationReport): string {
  const sections: string[] = [
    "# Summary",
    reportSummaryToCsv(report).trimEnd(),
    "",
    "# By Source",
    sourceBreakdownToCsv(report).trimEnd(),
    "",
    "# By Entity Type",
    entityBreakdownToCsv(report).trimEnd(),
    "",
    "# Confidence Histogram",
    histogramToCsv(report).trimEnd(),
  ];

  return sections.join("\n") + "\n";
}

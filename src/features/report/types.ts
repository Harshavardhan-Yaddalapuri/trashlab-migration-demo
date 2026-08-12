/**
 * Report domain types. Migration completion report with metrics,
 * breakdowns, and CSV export.
 */

/** Per-source breakdown in the report. */
export interface SourceBreakdown {
  /** Source kind (routepro-csv, quickbooks-export, etc.). */
  source: string;
  /** Total records from this source. */
  totalRecords: number;
  /** Records auto-mapped from this source. */
  autoMapped: number;
  /** Exceptions raised from this source. */
  exceptions: number;
  /** Auto-map rate for this source (0..1). */
  autoMapRate: number;
}

/** Per-entity-type breakdown in the report. */
export interface EntityBreakdown {
  /** Entity type (customer, site, container, etc.). */
  entityType: string;
  /** Total records of this type. */
  totalRecords: number;
  /** Records auto-mapped for this type. */
  autoMapped: number;
  /** Exceptions raised for this type. */
  exceptions: number;
  /** Auto-map rate for this type (0..1). */
  autoMapRate: number;
  /** Average confidence for this type (0..1). */
  avgConfidence: number;
}

/** A single bucket in the confidence histogram. */
export interface ConfidenceBucket {
  /** Range label (e.g. "0.9-1.0"). */
  range: string;
  /** Number of records in this bucket. */
  count: number;
  /** Percentage of total records in this bucket. */
  percentage: number;
}

/** The full migration report. */
export interface MigrationReport {
  /** The job this report covers. */
  jobId: string;
  /** When the report was generated. ISO-8601. */
  generatedAt: string;
  /** Total records in the migration. */
  totalRecords: number;
  /** Records that were auto-mapped (no human needed). */
  autoMapped: number;
  /** Records that raised exceptions. */
  exceptionCount: number;
  /** Auto-map rate (0..1). */
  autoMapRate: number;
  /** Exception rate (0..1). */
  exceptionRate: number;
  /** Number of silent errors detected (should be 0). */
  silentErrors: number;
  /** Days to go-live. */
  goLiveDays: number;
  /** Confidence histogram (10 buckets). */
  confidenceHistogram: ConfidenceBucket[];
  /** Per-source breakdown. */
  bySource: SourceBreakdown[];
  /** Per-entity-type breakdown. */
  byEntity: EntityBreakdown[];
}

/** Input data for computing a report. */
export interface ReportInput {
  jobId: string;
  totalRecords: number;
  autoMapped: number;
  exceptionCount: number;
  silentErrors: number;
  goLiveDays: number;
  /** Confidence values for histogram. */
  confidences: number[];
  /** Per-source data. */
  sources: Array<{
    source: string;
    totalRecords: number;
    autoMapped: number;
    exceptions: number;
  }>;
  /** Per-entity-type data. */
  entities: Array<{
    entityType: string;
    totalRecords: number;
    autoMapped: number;
    exceptions: number;
    confidenceSum: number;
    confidenceCount: number;
  }>;
}

/** CSV row shape for export. */
export type CsvRow = Record<string, string>;

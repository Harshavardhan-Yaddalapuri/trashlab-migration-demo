/**
 * Cockpit UI types. Extend the core domain types with view-model shapes
 * for the 3-pane pipeline view, activity feed, and confidence meters.
 */

import type { MigrationStatus, SourceFile, ExceptionIssue, Confidence } from "@/lib/types";

/** A single agent stage in the pipeline. */
export interface AgentStage {
  /** Unique stage key. */
  id: string;
  /** Human-readable label (no em-dashes). */
  label: string;
  /** Which pipeline status this stage maps to. */
  status: MigrationStatus;
  /** Progress for this stage, 0..1. */
  progress: number;
  /** Number of records processed by this stage. */
  processed: number;
  /** Total records this stage expects to process. */
  total: number;
  /** Throughput in records per second. */
  throughput: number;
  /** Whether this stage is currently active, waiting, done, or errored. */
  phase: "waiting" | "active" | "done" | "error";
}

/** A single event in the live activity feed. */
export interface PipelineEvent {
  /** Unique event ID. */
  id: string;
  /** Which agent stage produced this event. */
  stageId: string;
  /** Past-tense event type (e.g. "SourceParsed", "RecordNormalized"). */
  type: string;
  /** Short human-readable message. */
  message: string;
  /** ISO-8601 timestamp. */
  at: string;
  /** Severity for visual styling. */
  level: "info" | "warn" | "error";
}

/** A confidence distribution bucket for the histogram. */
export interface ConfidenceBucket {
  /** Lower bound of the bucket, 0..1 (upper bound is bucket + width). */
  lower: number;
  /** Number of records in this bucket. */
  count: number;
}

/** Summary of confidence across all mapped records. */
export interface ConfidenceSummary {
  /** Number of records with confidence >= 0.9 (auto-merged). */
  high: number;
  /** Number of records with confidence 0.7..0.9 (review). */
  medium: number;
  /** Number of records with confidence < 0.7 (exception). */
  low: number;
  /** Histogram buckets for the distribution. */
  buckets: ConfidenceBucket[];
  /** Mean confidence. */
  mean: Confidence;
}

/** View model for the left pane source-systems list. */
export interface SourceSystemView {
  id: string;
  kind: SourceFile["kind"];
  fileName: string;
  recordCount: number;
  status: "pending" | "parsing" | "parsed" | "error";
  parseErrors: number;
}

/** View model for the right pane exception queue item. */
export interface ExceptionQueueItem {
  id: string;
  type: string;
  severity: ExceptionIssue["severity"];
  summary: string;
  confidence: Confidence;
  reviewStatus: ExceptionIssue["reviewStatus"];
  suggestedFix: string;
}
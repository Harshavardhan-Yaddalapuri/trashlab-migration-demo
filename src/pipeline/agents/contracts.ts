/**
 * Typed agent contracts. Every agent implements one of these interfaces.
 * Agents are pure-ish: they take state slices and return typed results.
 * LLM judgment is optional and never owns a deterministic decision.
 */

import type {
  ExceptionIssue,
  MappingProposal,
  NormalizedRecord,
  RawRecord,
  ResolvedEntity,
  SourceFile,
} from "@/lib/types";

export interface IntakeResult {
  sourceFiles: SourceFile[];
  rawRecords: RawRecord[];
  parseErrors: Array<{ sourceFileId: string; row: number; message: string }>;
}

export interface NormalizeFlag {
  rawRecordId: string;
  field: string;
  note: string;
}

export type NormalizeEvent =
  | { type: "RecordNormalized"; recordId: string; entityType: string }
  | {
      type: "AmbiguityFlagged";
      recordId: string;
      entityType: string;
      field: string;
      note: string;
    };

export interface NormalizeResult {
  normalized: NormalizedRecord[];
  flagged: NormalizeFlag[];
  events: NormalizeEvent[];
}

export interface ResolveResult {
  resolved: ResolvedEntity[];
  clusters: Array<{ clusterId: string; memberIds: string[]; confidence: number }>;
  autoMerged: number;
  needsReview: number;
}

export interface MapResult {
  proposals: MappingProposal[];
  autoMapped: number;
  exceptions: ExceptionIssue[];
}

export interface ValidateResult {
  exceptions: ExceptionIssue[];
  validCount: number;
}

export interface ReviewResult {
  approved: ExceptionIssue[];
  rejected: ExceptionIssue[];
}

export interface TrainingResult {
  packets: Array<{ role: string; title: string; body: string }>;
}

export interface AgentContext {
  jobId: string;
  tenantId: string;
  now: () => string;
}

export interface IntakeAgent {
  run(ctx: AgentContext, files: SourceFile[]): Promise<IntakeResult>;
}

export interface NormalizeAgent {
  run(ctx: AgentContext, records: RawRecord[]): Promise<NormalizeResult>;
}

export interface ResolveAgent {
  run(ctx: AgentContext, records: NormalizedRecord[]): Promise<ResolveResult>;
}

export interface MapAgent {
  run(ctx: AgentContext, entities: ResolvedEntity[]): Promise<MapResult>;
}

export interface ValidateAgent {
  run(ctx: AgentContext, proposals: MappingProposal[]): Promise<ValidateResult>;
}

export interface ReviewAgent {
  run(ctx: AgentContext, exceptions: ExceptionIssue[]): Promise<ReviewResult>;
}

export interface TrainingAgent {
  run(ctx: AgentContext, report: { autoMapped: number; exceptionCount: number }): Promise<TrainingResult>;
}

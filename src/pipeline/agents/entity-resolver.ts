/**
 * Entity Resolver agent (LangGraph resolve node).
 *
 * Processes 45,000 normalized customer records through blocking-key buckets,
 * auto-merges duplicate clusters above threshold, and flags conflicts or
 * low-confidence clusters as exceptions.
 *
 * Rules are deterministic pure functions; similarity is weighted and
 * transitive within a bucket. Emits CustomerResolved / CustomerAutoMerged /
 * ExceptionRaised events.
 */

import type { ExceptionIssue, NormalizedRecord, ResolvedEntity } from "@/lib/types";
import { config } from "@/lib/config";
import {
  resolveCustomers,
  type CustomerRecordShape,
  type EntityCluster,
} from "@/pipeline/rules/dedup-keys";
import type {
  AgentContext,
  ResolveAgent,
  ResolveResult,
} from "./contracts";

function toCustomerShape(record: NormalizedRecord): CustomerRecordShape | null {
  if (record.entityType !== "customer") return null;
  const f = record.fields;
  return {
    id: record.id,
    name: f.name ?? "",
    phone: f.phone ?? "",
    address: f.address ?? "",
    email: f.email ?? null,
    city: f.city ?? null,
    state: f.state ?? null,
    zip: f.zip ?? null,
  };
}

function clusterToResolved(cluster: EntityCluster): ResolvedEntity {
  const canonicalFields: Record<string, string> = {};
  for (const [key, value] of Object.entries(cluster.canonicalFields)) {
    if (typeof value === "string" || typeof value === "number") {
      canonicalFields[key] = String(value ?? "");
    }
  }

  return {
    id: cluster.clusterId,
    entityType: "customer",
    clusterId: cluster.clusterId,
    confidence: cluster.confidence,
    merged: cluster.merged,
    canonicalFields,
  };
}

function buildException(ctx: AgentContext, cluster: EntityCluster): ExceptionIssue | null {
  if (cluster.merged && cluster.conflicts.length === 0) return null;

  const reason = cluster.conflicts.length > 0
    ? `Entity cluster ${cluster.clusterId} has conflicts that need review`
    : `Entity cluster ${cluster.clusterId} confidence (${cluster.confidence.toFixed(2)}) is below auto-merge threshold`;

  const severity = cluster.conflicts.some((c) => c.severity === "critical")
    ? "critical"
    : cluster.conflicts.length > 0
      ? "warning"
      : "info";

  return {
    id: `exc-${cluster.clusterId}`,
    jobId: ctx.jobId,
    type: "entity_resolution",
    severity,
    summary: reason,
    evidence: [
      `memberCount=${cluster.memberIds.length}`,
      `confidence=${cluster.confidence.toFixed(4)}`,
      ...cluster.conflicts.flatMap((c) => [`${c.kind} (${c.severity}): ${c.summary}`, ...c.evidence]),
    ],
    suggestedFix: cluster.conflicts.length > 0
      ? "Review conflicting fields and pick canonical values"
      : "Review cluster and confirm merge or split",
    reviewStatus: "open",
    createdAt: ctx.now(),
  };
}

export class EntityResolverAgent implements ResolveAgent {
  async run(ctx: AgentContext, records: NormalizedRecord[]): Promise<ResolveResult> {
    const customers: CustomerRecordShape[] = [];
    const nonCustomers: NormalizedRecord[] = [];

    for (const record of records) {
      const shape = toCustomerShape(record);
      if (shape) {
        customers.push(shape);
      } else {
        nonCustomers.push(record);
      }
    }

    const report = resolveCustomers(customers, {
      autoMergeThreshold: config.pipeline.autoMergeThreshold,
      mergeThreshold: 0.5,
    });

    const resolved: ResolvedEntity[] = [];
    const clusters: ResolveResult["clusters"] = [];
    const exceptions: ExceptionIssue[] = [];
    let autoMerged = 0;
    let needsReview = 0;

    for (const cluster of report.clusters) {
      resolved.push(clusterToResolved(cluster));
      clusters.push({
        clusterId: cluster.clusterId,
        memberIds: cluster.memberIds,
        confidence: cluster.confidence,
      });

      if (cluster.merged) {
        autoMerged += 1;
      } else if (cluster.memberIds.length > 1) {
        needsReview += 1;
      }

      const exc = buildException(ctx, cluster);
      if (exc !== null) {
        exceptions.push(exc);
      }
    }

    for (const record of nonCustomers) {
      resolved.push({
        id: `e-${record.id}`,
        entityType: record.entityType,
        clusterId: `c-${record.id}`,
        confidence: 1,
        merged: false,
        canonicalFields: { ...record.fields },
      });
    }

    return {
      resolved,
      clusters,
      autoMerged,
      needsReview,
    };
  }
}

export const entityResolverAgent: ResolveAgent = new EntityResolverAgent();

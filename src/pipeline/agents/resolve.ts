/**
 * Resolve agent: blocking-key dedup with weighted similarity.
 * O(n) with small buckets, never O(n²). Auto-merge above threshold,
 * exception below. Conflict detection within clusters.
 */

import type { NormalizedRecord, ResolvedEntity } from "@/lib/types";
import { config } from "@/lib/config";
import { resolveCustomers, type CustomerRecordShape, type EntityCluster } from "@/pipeline/rules/dedup-keys";
import type { AgentContext, ResolveAgent, ResolveResult } from "./contracts";

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

export class DeterministicResolveAgent implements ResolveAgent {
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

    const resolved: ResolvedEntity[] = report.clusters.map(clusterToResolved);

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

    const clusters: ResolveResult["clusters"] = report.clusters.map((c) => ({
      clusterId: c.clusterId,
      memberIds: c.memberIds,
      confidence: c.confidence,
    }));

    return {
      resolved,
      clusters,
      autoMerged: report.autoMerged,
      needsReview: report.needsReview,
    };
  }
}

export const resolveAgent: ResolveAgent = new DeterministicResolveAgent();

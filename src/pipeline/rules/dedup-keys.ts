/**
 * Dedup blocking keys + entity resolver core. Pure functions, deterministic.
 *
 * Blocking key = phonetic name + normalized phone. Address is used for
 * within-bucket similarity and conflict detection, not for partitioning,
 * because two records with the same phonetic name and phone but different
 * addresses need to be reviewed as a possible duplicate or conflict.
 *
 * O(n) with small buckets — phone+phonetic-name is highly discriminative.
 * Auto-merge above threshold; exception below. Conflict detection within
 * clusters (pricing + address).
 */

import { config } from "../../lib/config";
import { normalizeCompanyName } from "./name-normalizer";
import { normalizePhone } from "./phone-normalizer";

export interface CustomerRecordShape {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface ClusterMember {
  recordId: string;
  fields: CustomerRecordShape;
}

export interface EntityCluster {
  clusterId: string;
  memberIds: string[];
  confidence: number;
  merged: boolean;
  canonicalFields: CustomerRecordShape;
  conflicts: DetectedConflict[];
}

export interface DetectedConflict {
  kind: "pricing" | "address";
  severity: "warning" | "critical";
  summary: string;
  evidence: string[];
}

export interface ResolveReport {
  clusters: EntityCluster[];
  autoMerged: number;
  needsReview: number;
  totalRecords: number;
  conflictCount: number;
}

export interface SimilarityWeights {
  name: number;
  phone: number;
  address: number;
  email: number;
}

export const DEFAULT_WEIGHTS: SimilarityWeights = {
  name: 0.31,
  phone: 0.25,
  address: 0.34,
  email: 0.10,
};

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function stripLegalSuffixes(name: string): string {
  return name
    .replace(/\b(LLC|INC|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Soundex-lite: first letter + first 3 consonants. Good enough for blocking. */
export function phoneticKey(name: string): string {
  const cleaned = stripLegalSuffixes(name).toUpperCase();
  if (cleaned === "") return "";
  const first = cleaned[0];
  const consonants = cleaned.replace(/[AEIOUY\s]/g, "").slice(0, 3);
  return `${first}${consonants}`;
}

export function normalizeAddress(address: string): string {
  return collapseWhitespace(address)
    .toUpperCase()
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bLANE\b/g, "LN");
}

/** Blocking key: phonetic name + normalized phone. */
export function customerBlockingKey(
  nameOrRecord: string | CustomerRecordShape,
  phone?: string,
  address?: string,
): string {
  if (typeof nameOrRecord === "string") {
    const nameKey = phoneticKey(nameOrRecord);
    const phoneKey = phone !== undefined ? normalizePhone(phone) ?? "" : "";
    const addressKey = address !== undefined ? normalizeAddress(address) : "";
    // Keep the legacy composite shape for callers that still pass address,
    // but address no longer partitions records.
    return [nameKey, phoneKey, addressKey].join("|");
  }
  const record = nameOrRecord;
  const nameKey = phoneticKey(record.name);
  const phoneKey = normalizePhone(record.phone) ?? "";
  return [nameKey, phoneKey].join("|");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

/** Normalized string similarity using Levenshtein ratio, 0..1. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  return (longer.length - levenshtein(longer, shorter)) / longer.length;
}

/** Token-based Jaccard similarity for addresses, 0..1. */
export function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.toUpperCase().split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.toUpperCase().split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  let intersection = 0;
  for (const token of Array.from(tokensA)) {
    if (tokensB.has(token)) intersection += 1;
  }
  return intersection / (tokensA.size + tokensB.size - intersection);
}

export interface AgreementFields {
  containerId?: string;
  siteId?: string;
  rateCents?: number;
}

/** Compare two customer records and return a weighted similarity score. */
export function customerSimilarity(
  a: CustomerRecordShape,
  b: CustomerRecordShape,
  weights: SimilarityWeights = DEFAULT_WEIGHTS,
): number {
  const nameA = normalizeCompanyName(a.name).toUpperCase();
  const nameB = normalizeCompanyName(b.name).toUpperCase();
  const nameSim = similarity(nameA, nameB);

  const phoneA = normalizePhone(a.phone) ?? "";
  const phoneB = normalizePhone(b.phone) ?? "";
  const phoneSim = phoneA && phoneB && phoneA === phoneB ? 1 : 0;

  const addrA = normalizeAddress(a.address);
  const addrB = normalizeAddress(b.address);
  const addressSim = jaccardSimilarity(addrA, addrB);

  const emailA = (a.email ?? "").trim().toLowerCase();
  const emailB = (b.email ?? "").trim().toLowerCase();
  const emailSim = emailA && emailB && emailA === emailB ? 1 : 0;

  const totalWeight = weights.name + weights.phone + weights.address + weights.email;
  let score =
    (weights.name * nameSim +
      weights.phone * phoneSim +
      weights.address * addressSim +
      weights.email * emailSim) /
    totalWeight;

  // Strong signal boost: exact phone + exact normalized address means the
  // records almost certainly refer to the same entity, even if the name is
  // abbreviated or contains minor typos.
  if (phoneSim === 1 && addressSim === 1) {
    score = Math.max(score, 0.9);
  }

  return Number(score.toFixed(6));
}

/** Union-Find for transitive cluster merging within a bucket. */
class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  find(i: number): number {
    let root = i;
    while (this.parent[root] !== root) {
      this.parent[root] = this.parent[this.parent[root]];
      root = this.parent[root];
    }
    return root;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb;
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra] += 1;
    }
  }
}

/** Merge records into sub-clusters whenever pairwise similarity >= threshold. */
function mergeWithinBucket(
  members: ClusterMember[],
  threshold: number,
  weights: SimilarityWeights,
): number[][] {
  if (members.length <= 1) return [Array.from({ length: members.length }, (_, i) => i)];

  const uf = new UnionFind(members.length);
  // Pairwise within a bucket only — buckets are designed to stay small.
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const score = customerSimilarity(members[i].fields, members[j].fields, weights);
      if (score >= threshold) {
        uf.union(i, j);
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < members.length; i += 1) {
    const root = uf.find(i);
    const group = groups.get(root) ?? [];
    group.push(i);
    groups.set(root, group);
  }
  return Array.from(groups.values());
}

function averageConfidence(group: number[], members: ClusterMember[], weights: SimilarityWeights): number {
  if (group.length <= 1) return 1;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < group.length; i += 1) {
    for (let j = i + 1; j < group.length; j += 1) {
      sum += customerSimilarity(members[group[i]].fields, members[group[j]].fields, weights);
      count += 1;
    }
  }
  return Number((sum / Math.max(count, 1)).toFixed(6));
}

function buildCanonicalFields(group: number[], members: ClusterMember[]): CustomerRecordShape {
  const chosen = members[group[0]].fields;
  const best = group
    .map((idx) => members[idx].fields)
    .reduce((acc, cur) => {
      const accScore = (acc.name ?? "").length + (acc.email ?? "").length;
      const curScore = (cur.name ?? "").length + (cur.email ?? "").length;
      return curScore >= accScore ? cur : acc;
    }, chosen);
  return { ...best };
}

/** Detect conflicts within a cluster: pricing and address mismatches. */
function detectConflicts(group: number[], members: ClusterMember[]): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const records = group.map((idx) => members[idx].fields);

  // Address conflict: same canonical name/phone but materially different addresses.
  const addresses = new Set(records.map((r) => normalizeAddress(r.address).replace(/\s+/g, " ")));
  if (addresses.size > 1) {
    const name = normalizeCompanyName(records[0].name);
    conflicts.push({
      kind: "address",
      severity: "warning",
      summary: `Cluster "${name}" has ${addresses.size} different addresses`,
      evidence: Array.from(addresses).slice(0, 5),
    });
  }

  // Pricing conflict: same container+site with different rates.
  const rateByKey = new Map<string, number>();
  for (const r of records) {
    const agreement = (r as unknown as { agreement?: AgreementFields }).agreement;
    if (agreement) {
      const containerId = agreement.containerId ?? "";
      const siteId = agreement.siteId ?? "";
      const rateCents = agreement.rateCents;
      if (containerId && siteId && typeof rateCents === "number") {
        const key = `${siteId}|${containerId}`;
        const existing = rateByKey.get(key);
        if (existing !== undefined && existing !== rateCents) {
          conflicts.push({
            kind: "pricing",
            severity: "critical",
            summary: `Conflicting rates for site ${siteId} / container ${containerId}`,
            evidence: [`$${(existing / 100).toFixed(2)}`, `$${(rateCents / 100).toFixed(2)}`],
          });
        }
        rateByKey.set(key, rateCents);
      }
    }
  }

  return conflicts;
}

/** Resolve a list of customer-shaped records into deduplication clusters. */
export function resolveCustomers(
  records: CustomerRecordShape[],
  options: {
    autoMergeThreshold?: number;
    mergeThreshold?: number;
    weights?: SimilarityWeights;
    idPrefix?: string;
  } = {},
): ResolveReport {
  const autoMergeThreshold = options.autoMergeThreshold ?? config.pipeline.autoMergeThreshold;
  const mergeThreshold = options.mergeThreshold ?? 0.5;
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const idPrefix = options.idPrefix ?? "c";

  // 1. Build blocking-key buckets — O(n).
  const buckets = new Map<string, ClusterMember[]>();
  for (const record of records) {
    const key = customerBlockingKey(record);
    const member: ClusterMember = { recordId: record.id, fields: record };
    const bucket = buckets.get(key) ?? [];
    bucket.push(member);
    buckets.set(key, bucket);
  }

  // 2. Within each bucket, merge by pairwise similarity — bucket sizes are bounded.
  const clusters: EntityCluster[] = [];
  let autoMerged = 0;
  let needsReview = 0;
  let conflictCount = 0;

  for (const [key, members] of Array.from(buckets.entries())) {
    if (members.length === 1) {
      // Suffix with the running cluster count, same as the multi-member
      // branch below: a blocking key can coincidentally collide with
      // another bucket's "key-N" generated id (both are just strings),
      // but the strictly-increasing counter can't repeat, so it
      // guarantees a globally unique clusterId either way.
      clusters.push({
        clusterId: `${idPrefix}-${key}-${clusters.length}`,
        memberIds: [members[0].recordId],
        confidence: 1,
        merged: false,
        canonicalFields: { ...members[0].fields },
        conflicts: [],
      });
      continue;
    }

    const groups = mergeWithinBucket(members, mergeThreshold, weights);
    for (const group of groups) {
      const confidence = averageConfidence(group, members, weights);
      const merged = group.length > 1 && confidence >= autoMergeThreshold;
      const memberIds = group.map((idx) => members[idx].recordId);
      const conflicts = detectConflicts(group, members);
      if (conflicts.length > 0) conflictCount += 1;
      if (merged) autoMerged += 1;
      else if (group.length > 1) needsReview += 1;

      clusters.push({
        clusterId: `${idPrefix}-${key}-${clusters.length}`,
        memberIds,
        confidence,
        merged,
        canonicalFields: buildCanonicalFields(group, members),
        conflicts,
      });
    }
  }

  return {
    clusters,
    autoMerged,
    needsReview,
    totalRecords: records.length,
    conflictCount,
  };
}

/**
 * Bridges the review feature's in-memory exception store to Postgres.
 *
 * `features/review/exception-store.ts` is a pure, synchronous, well-tested
 * Map — its unit tests don't (and shouldn't) depend on a live DB. Rather
 * than making that module async, each request that needs it hydrates a
 * fresh copy from Postgres, lets the existing pure business logic
 * (approve/reject/bulk-resolve) run against it, then writes the result
 * back. The in-memory store is just a per-request working copy.
 */

import { and, eq } from "drizzle-orm";
import type { ExceptionCard } from "@/features/review";
import { putExceptions } from "@/features/review";
import { db } from "@/server/db/client";
import { exceptions } from "@/server/db/schema";

function toIso(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined;
}

function rowToCard(row: typeof exceptions.$inferSelect): ExceptionCard {
  return {
    id: row.id,
    jobId: row.jobId,
    type: row.type,
    severity: row.severity as ExceptionCard["severity"],
    summary: row.summary,
    evidence: row.evidence as string[],
    suggestedFix: row.suggestedFix,
    reviewStatus: row.reviewStatus as ExceptionCard["reviewStatus"],
    createdAt: row.createdAt.toISOString(),
    resolvedAt: toIso(row.resolvedAt),
    confidence: row.confidence,
    sourceRecord: row.sourceRecord,
    editedFields: (row.editedFields as Record<string, string> | null) ?? undefined,
    reviewedBy: row.reviewedBy ?? undefined,
    reviewedAt: toIso(row.reviewedAt),
    rejectionReason: row.rejectionReason ?? undefined,
  };
}

/** Load a job's exceptions from Postgres into the in-memory review store. */
export async function hydrateExceptionStore(jobId: string): Promise<void> {
  const rows = await db.select().from(exceptions).where(eq(exceptions.jobId, jobId));
  putExceptions(rows.map(rowToCard));
}

/** Write an updated exception card back to Postgres. */
export async function persistExceptionCard(card: ExceptionCard): Promise<void> {
  await db
    .update(exceptions)
    .set({
      reviewStatus: card.reviewStatus,
      editedFields: card.editedFields ?? null,
      reviewedBy: card.reviewedBy ?? null,
      reviewedAt: card.reviewedAt ? new Date(card.reviewedAt) : null,
      rejectionReason: card.rejectionReason ?? null,
      resolvedAt: card.resolvedAt ? new Date(card.resolvedAt) : null,
    })
    .where(and(eq(exceptions.id, card.id), eq(exceptions.jobId, card.jobId)));
}

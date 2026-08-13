/**
 * GET /api/v1/migration-jobs/[jobId]/entities/[entityType]
 *
 * Paginated real business records for one entity type in a job: resolved
 * entities' canonical fields (already plain business data -- name, phone,
 * address, service code, etc), each with any open exceptions attached as
 * annotations, and for agreements, the mapping proposal's confidence and
 * mapped fields. Keyset paginated, never OFFSET (see config.db.pageSize).
 */

import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { apiError, withApiErrorHandling } from "@/server/api/contracts";
import { db } from "@/server/db/client";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; entityType: string }> },
): Promise<NextResponse> {
  return withApiErrorHandling("GET /api/v1/migration-jobs/[jobId]/entities/[entityType]", async () => {
    const { jobId, entityType } = await params;
    const cursor = request.nextUrl.searchParams.get("cursor");
    const pageSize = config.db.pageSize;

    const rowsResult = await db.execute(sql`
      SELECT
        re.id,
        re.entity_type,
        re.confidence,
        re.merged,
        re.canonical_fields,
        p.confidence AS proposal_confidence,
        p.mapped_fields,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', e.id,
                'type', e.type,
                'severity', e.severity,
                'summary', e.summary,
                'evidence', e.evidence,
                'suggestedFix', e.suggested_fix,
                'confidence', e.confidence,
                'reviewStatus', e.review_status
              )
              ORDER BY e.created_at
            )
            FROM exceptions e
            WHERE e.resolved_entity_id = re.id AND e.job_id = ${jobId}
          ),
          '[]'
        ) AS exceptions
      FROM resolved_entities re
      LEFT JOIN proposals p ON p.resolved_entity_id = re.id AND p.job_id = ${jobId}
      WHERE re.job_id = ${jobId}
        AND re.entity_type = ${entityType}
        AND (${cursor}::text IS NULL OR re.id > ${cursor}::text)
      ORDER BY re.id
      LIMIT ${pageSize + 1}
    `);

    if (rowsResult.rows.length === 0 && cursor === null) {
      // Distinguish "job has no data yet" from "this page is just empty"
      const anyResult = await db.execute(
        sql`SELECT 1 FROM resolved_entities WHERE job_id = ${jobId} LIMIT 1`,
      );
      if (anyResult.rows.length === 0) {
        return NextResponse.json(
          apiError("no_data", `Job ${jobId} has no pipeline output yet`),
          { status: 404 },
        );
      }
    }

    const hasMore = rowsResult.rows.length > pageSize;
    const page = rowsResult.rows.slice(0, pageSize);
    const nextCursor = hasMore ? String(page[page.length - 1].id) : null;

    return NextResponse.json({
      items: page.map((row) => ({
        id: row.id,
        entityType: row.entity_type,
        confidence: row.proposal_confidence !== null ? Number(row.proposal_confidence) : Number(row.confidence),
        fields: row.canonical_fields,
        mappedFields: row.mapped_fields,
        exceptions: row.exceptions,
      })),
      nextCursor,
    });
  });
}

/**
 * POST /api/v1/migration-jobs — create a migration job from uploaded source files.
 * GET  /api/v1/migration-jobs — list jobs, newest first.
 */

import { desc } from "drizzle-orm";
import { after, NextRequest, NextResponse } from "next/server";
import { fnv1a } from "@/data/generate";
import type { SourceFile, SourceKind } from "@/lib/types";
import { apiError } from "@/server/api/contracts";
import { db } from "@/server/db/client";
import { migrationJobs, sourceFiles, tenants } from "@/server/db/schema";
import { runPipelineForJob } from "@/server/pipeline-runner";

export const runtime = "nodejs";
// The response itself returns almost immediately; this bounds the
// after() callback that runs the pipeline and persists its output
// (150k records means ~500 sequential chunked inserts to Postgres).
export const maxDuration = 300;

interface SourceFileInput {
  kind: SourceKind;
  fileName: string;
  recordCount: number;
  /** Vercel Blob URL the browser uploaded the file content to directly. */
  blobUrl: string;
}

interface CreateJobBody {
  tenantId?: string;
  sourceFiles: SourceFileInput[];
}

async function resolveTenantId(tenantId?: string): Promise<string> {
  if (tenantId) return tenantId;

  const existing = await db.select({ id: tenants.id }).from(tenants).limit(1);
  if (existing.length > 0) return existing[0].id;

  const [created] = await db.insert(tenants).values({ name: "Demo Tenant" }).returning({ id: tenants.id });
  return created.id;
}

/** Fetch a source file's real content from Blob storage (public, plain fetch). */
async function fetchBlobContent(blobUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(blobUrl);
    if (!res.ok) return undefined;
    return await res.text();
  } catch (err) {
    console.error(`failed to fetch blob content from ${blobUrl}:`, err);
    return undefined;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: CreateJobBody;
  try {
    body = (await request.json()) as CreateJobBody;
  } catch {
    return NextResponse.json(apiError("invalid_body", "Request body must be valid JSON"), { status: 400 });
  }

  if (!Array.isArray(body.sourceFiles) || body.sourceFiles.length === 0) {
    return NextResponse.json(
      apiError("missing_fields", "sourceFiles is required and must be a non-empty array"),
      { status: 400 },
    );
  }

  for (const file of body.sourceFiles) {
    if (!file.kind || !file.fileName || typeof file.recordCount !== "number" || !file.blobUrl) {
      return NextResponse.json(
        apiError("missing_fields", "each sourceFile requires kind, fileName, recordCount, blobUrl"),
        { status: 400 },
      );
    }
  }

  const tenantId = await resolveTenantId(body.tenantId);

  const [job] = await db
    .insert(migrationJobs)
    .values({ tenantId, status: "pending", progress: 0 })
    .returning();

  const insertedFiles = await db
    .insert(sourceFiles)
    .values(
      body.sourceFiles.map((file) => ({
        jobId: job.id,
        kind: file.kind,
        fileName: file.fileName,
        recordCount: file.recordCount,
        rawHash: fnv1a(file.blobUrl),
      })),
    )
    .returning();

  // Run the pipeline after the response is sent. Blob content is fetched
  // here (not persisted to source_files) and handed to the pipeline as
  // in-memory SourceFile content, same as before Blob storage existed.
  after(async () => {
    const pipelineInput: SourceFile[] = await Promise.all(
      insertedFiles.map(async (row, i) => ({
        id: row.id,
        kind: row.kind as SourceKind,
        fileName: row.fileName,
        recordCount: row.recordCount,
        rawHash: row.rawHash,
        ingestedAt: row.ingestedAt.toISOString(),
        content: await fetchBlobContent(body.sourceFiles[i].blobUrl),
      })),
    );
    await runPipelineForJob(job.id, pipelineInput).catch((err) => {
      console.error(`pipeline run failed for job ${job.id}:`, err);
    });
  });

  return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
}

export async function GET(): Promise<NextResponse> {
  const jobs = await db
    .select({
      id: migrationJobs.id,
      status: migrationJobs.status,
      progress: migrationJobs.progress,
      createdAt: migrationJobs.createdAt,
      updatedAt: migrationJobs.updatedAt,
    })
    .from(migrationJobs)
    .orderBy(desc(migrationJobs.createdAt));

  return NextResponse.json({ jobs });
}

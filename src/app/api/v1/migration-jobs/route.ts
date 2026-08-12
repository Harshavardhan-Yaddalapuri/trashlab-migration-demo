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
export const maxDuration = 60;

interface SourceFileInput {
  kind: SourceKind;
  fileName: string;
  recordCount: number;
  content?: string;
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
    if (!file.kind || !file.fileName || typeof file.recordCount !== "number") {
      return NextResponse.json(
        apiError("missing_fields", "each sourceFile requires kind, fileName, recordCount"),
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
        rawHash: fnv1a(file.content ?? `${file.fileName}:${file.recordCount}`),
      })),
    )
    .returning();

  // Run the pipeline after the response is sent. Content is only ever held
  // in memory for this request — it is not persisted to source_files.
  const pipelineInput: SourceFile[] = insertedFiles.map((row, i) => ({
    id: row.id,
    kind: row.kind as SourceKind,
    fileName: row.fileName,
    recordCount: row.recordCount,
    rawHash: row.rawHash,
    ingestedAt: row.ingestedAt.toISOString(),
    content: body.sourceFiles[i]?.content,
  }));

  after(async () => {
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

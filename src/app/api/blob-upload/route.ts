/**
 * POST /api/blob-upload
 *
 * Issues short-lived client tokens for direct browser -> Vercel Blob
 * uploads. Source files (up to ~13MB combined) blow past Vercel's 4.5MB
 * serverless function request-body limit if sent inline in the
 * migration-jobs POST body, so the browser uploads file content straight
 * to Blob storage and only a small blob URL is sent to our API.
 */

import { handleUpload } from "@vercel/blob/client";
import type { HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        // Legacy exports arrive in whatever shape the source system produces.
        // The browser infers contentType from the file extension, which can
        // be misleading -- a whitespace-aligned plain-text file named
        // "*.xlsx" still gets tagged as a real spreadsheet MIME type. Cover
        // both the plain-text formats these exports actually use and the
        // real spreadsheet types, rather than rejecting on a mismatch.
        allowedContentTypes: [
          "text/csv",
          "text/tab-separated-values",
          "text/plain",
          "text/*",
          "application/octet-stream",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        addRandomSuffix: true,
        maximumSizeInBytes: 50 * 1024 * 1024,
      }),
      onUploadCompleted: async () => {
        // No-op: the migration-jobs API fetches the blob content itself
        // once the client posts the resulting URL.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

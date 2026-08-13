/**
 * API contracts. Contract-first: every route returns a JSON object root,
 * informative errors, and idempotent writes. Keyset pagination, never OFFSET.
 */

import { NextResponse } from "next/server";

export interface ApiError {
  reason: string;
  localizedMessage: string;
  details?: Record<string, unknown>;
}

export interface KeysetPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface JobSummary {
  id: string;
  status: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExceptionDto {
  id: string;
  type: string;
  severity: string;
  summary: string;
  evidence: string[];
  suggestedFix: string;
  reviewStatus: string;
}

export function apiError(reason: string, localizedMessage: string, details?: Record<string, unknown>): ApiError {
  return { reason, localizedMessage, details };
}

/**
 * Wraps a route handler so an unexpected failure (a DB error, a thrown
 * exception) returns the app's own consistent error shape instead of
 * Next.js's generic framework error response.
 */
export async function withApiErrorHandling(routeName: string, handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${routeName} failed:`, err);
    return NextResponse.json(apiError("internal_error", "Something went wrong on our end.", { message }), {
      status: 500,
    });
  }
}

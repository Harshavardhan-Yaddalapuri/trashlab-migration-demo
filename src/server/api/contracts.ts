/**
 * API contracts. Contract-first: every route returns a JSON object root,
 * informative errors, and idempotent writes. Keyset pagination, never OFFSET.
 */

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

/**
 * In-memory exception store for the review API.
 * In production this is the `exceptions` table in Postgres.
 * The pipeline pushes exceptions here; the API reads and mutates them.
 */

import type { ExceptionCard } from "./types";

const store = new Map<string, ExceptionCard>();

function key(jobId: string, exceptionId: string): string {
  return `${jobId}::${exceptionId}`;
}

/** Store an exception card. */
export function putException(card: ExceptionCard): void {
  store.set(key(card.jobId, card.id), card);
}

/** Store multiple exception cards. */
export function putExceptions(cards: ExceptionCard[]): void {
  for (const card of cards) {
    store.set(key(card.jobId, card.id), card);
  }
}

/** Get an exception by job and exception ID. */
export function getException(jobId: string, exceptionId: string): ExceptionCard | undefined {
  return store.get(key(jobId, exceptionId));
}

/** Get all exceptions for a job. */
export function getExceptionsForJob(jobId: string): ExceptionCard[] {
  const result: ExceptionCard[] = [];
  for (const [k, card] of store.entries()) {
    if (k.startsWith(`${jobId}::`)) {
      result.push(card);
    }
  }
  return result;
}

/** Update an exception card in place. */
export function updateException(card: ExceptionCard): void {
  store.set(key(card.jobId, card.id), card);
}

/** Clear the store. For tests only. */
export function clearExceptionStore(): void {
  store.clear();
}

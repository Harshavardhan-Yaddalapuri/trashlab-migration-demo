/**
 * Fixed-window rate limiting backed by Postgres. No Redis/KV -- at this
 * project's actual traffic volume, reusing the existing DB connection is
 * simpler than standing up new infrastructure for it.
 */

import { and, gte, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { rateLimitEvents } from "@/server/db/schema";

/**
 * Returns true if `key` is still under `max` events within the last
 * `windowMs`, and records this attempt. Returns false (and does not record
 * an extra event) if the caller is already at the limit.
 */
export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rateLimitEvents)
    .where(and(sql`${rateLimitEvents.key} = ${key}`, gte(rateLimitEvents.createdAt, windowStart)));

  if (count >= max) {
    return false;
  }

  await db.insert(rateLimitEvents).values({ key });

  // Opportunistic cleanup, no cron needed: cheap relative to the insert
  // above since it's a single indexed range delete, and keeps the table
  // from growing unbounded at this traffic volume.
  if (Math.random() < 0.05) {
    const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.delete(rateLimitEvents).where(sql`${rateLimitEvents.createdAt} < ${staleBefore}`);
  }

  return true;
}

/** Best-effort real client IP from Vercel's forwarding headers. */
export function clientIpFrom(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

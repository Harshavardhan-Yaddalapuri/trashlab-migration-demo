/**
 * Postgres client. Server-side only. Never import from client components.
 *
 * Both `pool` and `db` are lazy: the real `pg.Pool` (and the DATABASE_URL
 * validation inside it) is only constructed on first actual use, not at
 * module import time. Next.js's build step imports every route module to
 * read its metadata (runtime, maxDuration) without ever calling the
 * handler -- an eager Pool here would mean the build itself requires a
 * live DATABASE_URL, which broke CI (no DB credentials in that environment
 * by design) even though no route was actually queried.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseUrl } from "@/lib/config";
import * as schema from "./schema";

declare global {
  var __trashlabPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis.__trashlabPool) {
    // Pipeline persistence runs one COPY stream per table (see
    // pipeline-runner.ts's copyInsert) sequentially, plus normal
    // request/polling traffic on top -- 10 gives headroom for both without
    // over-requesting connections from Neon's pooled endpoint.
    globalThis.__trashlabPool = new Pool({ connectionString: databaseUrl(), max: 10 });
  }
  return globalThis.__trashlabPool;
}

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!cachedDb) {
    cachedDb = drizzle(getPool(), { schema });
  }
  return cachedDb;
}

function lazyProxy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const instance = resolve();
      const value = Reflect.get(instance as object, prop, receiver);
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
}

export const db = lazyProxy(getDb);
export const pool = lazyProxy(getPool);

/**
 * Postgres client. Server-side only. Never import from client components.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseUrl } from "@/lib/config";
import * as schema from "./schema";

declare global {
  var __trashlabPool: Pool | undefined;
}

function createPool(): Pool {
  // Pipeline persistence runs one COPY stream per table (see
  // pipeline-runner.ts's copyInsert) concurrently across 6 tables, plus
  // normal request/polling traffic on top -- 10 gives headroom for both
  // without over-requesting connections from Neon's pooled endpoint.
  return new Pool({ connectionString: databaseUrl(), max: 10 });
}

const pool = globalThis.__trashlabPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  globalThis.__trashlabPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };

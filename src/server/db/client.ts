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
  return new Pool({ connectionString: databaseUrl() });
}

const pool = globalThis.__trashlabPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  globalThis.__trashlabPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };

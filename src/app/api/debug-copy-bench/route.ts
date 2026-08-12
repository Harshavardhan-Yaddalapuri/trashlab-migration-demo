/**
 * TEMP diagnostic route: measures real COPY transfer time from this
 * deployment's actual network path to Neon, isolated from pipeline
 * compute. Delete once the persistence timing question is settled.
 */

import { NextResponse } from "next/server";
import { from as copyFrom } from "pg-copy-streams";
import { pool } from "@/server/db/client";

export const runtime = "nodejs";
export const maxDuration = 60;

function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}
function csvRow(values: unknown[]): string {
  return values.map(csvField).join(",") + "\n";
}

export async function GET(): Promise<NextResponse> {
  const results: Record<string, unknown> = {};
  const setup = await pool.connect();
  await setup.query("CREATE TABLE IF NOT EXISTS copy_bench (id text, job_id uuid, data jsonb, n real)");
  await setup.query("TRUNCATE copy_bench");
  setup.release();

  for (const rowCount of [18000, 37000, 144026]) {
    const rows: unknown[][] = [];
    for (let i = 0; i < rowCount; i++) {
      rows.push([`id-${i}`, "00000000-0000-0000-0000-000000000000", JSON.stringify({ name: "sample data field", i, addr: "123 Main St, Springfield" }), Math.random()]);
    }
    const t0 = Date.now();
    const client = await pool.connect();
    try {
      const stream = client.query(copyFrom("COPY copy_bench (id, job_id, data, n) FROM STDIN WITH (FORMAT csv)"));
      const csv = rows.map((r) => csvRow(r)).join("");
      const tBuilt = Date.now();
      await new Promise<void>((resolve, reject) => {
        stream.on("error", reject);
        stream.on("finish", resolve);
        stream.end(csv);
      });
      results[`rows_${rowCount}`] = {
        csvBytes: csv.length,
        buildMs: tBuilt - t0,
        transferMs: Date.now() - tBuilt,
        totalMs: Date.now() - t0,
      };
    } finally {
      client.release();
    }
  }

  return NextResponse.json(results);
}

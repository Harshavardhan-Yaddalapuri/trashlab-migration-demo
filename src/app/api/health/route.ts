import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: config.app.name,
    version: config.app.version,
    time: new Date().toISOString(),
  });
}

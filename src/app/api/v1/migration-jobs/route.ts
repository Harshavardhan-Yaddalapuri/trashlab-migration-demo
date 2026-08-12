import { NextResponse } from "next/server";
import { apiError } from "@/server/api/contracts";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    apiError("not_implemented", "Migration job API is not implemented yet"),
    { status: 501 },
  );
}

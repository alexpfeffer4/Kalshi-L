import { NextResponse } from "next/server";
import { getRuntimeConfigStatus } from "@/lib/env";

export async function GET() {
  return NextResponse.json(getRuntimeConfigStatus());
}

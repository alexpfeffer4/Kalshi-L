import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { listEventAuditLogs } from "@/lib/store";

export async function GET(_request, { params }) {
  await requireAdminAuth();
  const { id } = await params;
  return NextResponse.json({ logs: await listEventAuditLogs(id) });
}

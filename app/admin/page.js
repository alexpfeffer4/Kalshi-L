import { requireAdminAuth } from "@/lib/admin-auth";
import DashboardClient from "@/components/dashboard-client";
import { getRuntimeConfigStatus } from "@/lib/env";
import { listEvents, listIngestionRuns } from "@/lib/store";

export default async function AdminPage() {
  await requireAdminAuth();
  const events = await listEvents();
  const ingestionRuns = await listIngestionRuns();
  const runtimeStatus = getRuntimeConfigStatus();
  return <DashboardClient admin initialEvents={events} initialRuns={ingestionRuns} runtimeStatus={runtimeStatus} />;
}

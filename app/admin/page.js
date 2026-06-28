import { requireAdminAuth } from "@/lib/admin-auth";
import DashboardClient from "@/components/dashboard-client";
import { getRuntimeConfigStatus } from "@/lib/env";
import { listEvents, listIngestionRuns } from "@/lib/store";

export default async function AdminPage() {
  await requireAdminAuth();
  const runtimeStatus = getRuntimeConfigStatus();
  const [eventsResult, runsResult] = await Promise.allSettled([listEvents(), listIngestionRuns()]);
  const events = eventsResult.status === "fulfilled" ? eventsResult.value : [];
  const ingestionRuns = runsResult.status === "fulfilled" ? runsResult.value : [];
  const loadWarning =
    eventsResult.status === "rejected" || runsResult.status === "rejected"
      ? "One of the server data sources failed to load, so the admin board is showing what it can instead of crashing."
      : "";
  return (
    <DashboardClient
      admin
      initialEvents={events}
      initialRuns={ingestionRuns}
      runtimeStatus={{ ...runtimeStatus, loadWarning }}
    />
  );
}

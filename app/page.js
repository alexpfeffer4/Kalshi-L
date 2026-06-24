import DashboardClient from "@/components/dashboard-client";
import { getRuntimeConfigStatus } from "@/lib/env";
import { listEvents } from "@/lib/store";

export default async function HomePage() {
  const events = await listEvents();
  const runtimeStatus = getRuntimeConfigStatus();
  return <DashboardClient initialEvents={events} runtimeStatus={runtimeStatus} />;
}

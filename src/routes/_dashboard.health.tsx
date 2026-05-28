import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getHealthMetrics } from "~/server/rpc/dashboard";
import { HealthDashboard } from "~/features/dashboard/health";

export const Route = createFileRoute("/_dashboard/health")({
  component: HealthRoute,
});

function HealthRoute() {
  const { data: metrics } = useSuspenseQuery({
    queryKey: ["health-metrics"],
    queryFn: () => getHealthMetrics(),
    staleTime: 60_000,
  });

  return <HealthDashboard metrics={metrics} />;
}

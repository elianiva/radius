import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getDashboardMetrics } from "~/server/rpc/dashboard";
import { Overview } from "~/features/dashboard/overview";

export const Route = createFileRoute("/_dashboard/overview")({
  component: OverviewRoute,
});

function OverviewRoute() {
  const { data: metrics } = useSuspenseQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: () => getDashboardMetrics(),
    staleTime: 60_000,
  });

  return <Overview metrics={metrics} />;
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SwearingDashboard } from "~/features/dashboard/swearing";
import { getSwearMetrics } from "~/server/rpc/dashboard/swearing";
import { useDashboardFilters } from "~/hooks/use-dashboard-filters";

export const Route = createFileRoute("/_dashboard/swearing")({
	component: SwearingRoute,
});

function SwearingRoute() {
	const filters = useDashboardFilters(Route.useSearch());

	const swears = useQuery({
		queryKey: ["swear-metrics", filters],
		queryFn: () => getSwearMetrics({ data: { filters } }),
		staleTime: 120_000,
	});

	return <SwearingDashboard data={swears.data} isLoading={swears.isLoading} />;
}

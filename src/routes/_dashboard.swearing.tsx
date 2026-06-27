import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SwearingDashboard } from "~/features/dashboard/swearing";
import { SwearRpc } from "~/server/rpc/dashboard/swearing";
import { useDashboardFilters } from "~/hooks/use-dashboard-filters";

export const Route = createFileRoute("/_dashboard/swearing")({
	component: SwearingRoute,
});

function SwearingRoute() {
	const filters = useDashboardFilters(Route.useSearch());

	const swears = useQuery(SwearRpc.metrics(filters));

	return <SwearingDashboard data={swears.data} isLoading={swears.isLoading} />;
}

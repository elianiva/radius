import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SwearingDashboard } from "~/features/dashboard/swearing";
import { getSwearMetrics } from "~/server/rpc/dashboard/swearing";

export const Route = createFileRoute("/_dashboard/swearing")({
	component: SwearingRoute,
});

function SwearingRoute() {
	const swears = useQuery({
		queryKey: ["swear-metrics"],
		queryFn: () => getSwearMetrics(),
		staleTime: 120_000,
	});

	return <SwearingDashboard data={swears.data} isLoading={swears.isLoading} />;
}

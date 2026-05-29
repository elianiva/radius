import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { SwearingDashboard } from "~/features/dashboard/swearing";
import { getSwearMetrics } from "~/server/rpc/dashboard/swearing";
import type { DashboardFilters } from "~/features/dashboard/services/filters";

export const Route = createFileRoute("/_dashboard/swearing")({
	component: SwearingRoute,
});

function SwearingRoute() {
	const search = useSearch({ strict: false });

	const filters: DashboardFilters | undefined = useMemo(() => {
		const f: DashboardFilters = {};
		let hasAny = false;
		if (search.dateFrom != null) { f.dateFrom = search.dateFrom; hasAny = true; }
		if (search.dateTo != null) { f.dateTo = search.dateTo; hasAny = true; }
		if (search.projectIds?.length) { f.projectIds = search.projectIds; hasAny = true; }
		if (search.model) { f.model = search.model; hasAny = true; }
		return hasAny ? f : undefined;
	}, [search.dateFrom, search.dateTo, search.projectIds, search.model]);

	const swears = useQuery({
		queryKey: ["swear-metrics", filters],
		queryFn: () => getSwearMetrics({ data: { filters } }),
		staleTime: 120_000,
	});

	return <SwearingDashboard data={swears.data} isLoading={swears.isLoading} />;
}

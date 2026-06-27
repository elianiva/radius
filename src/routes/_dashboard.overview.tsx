import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Overview } from "~/features/dashboard/overview";
import { useDashboardFilters } from "~/hooks/use-dashboard-filters";

import {
	getOverviewCards,
	getCostOverTime,
	getModelUsage,
	getTopProjects,
	getThinkingLevels,
	getStopReasons,
} from "~/server/rpc/dashboard/overview";

export const Route = createFileRoute("/_dashboard/overview")({
	component: OverviewRoute,
});

function OverviewRoute() {
	const filters = useDashboardFilters(Route.useSearch());

	const cards = useSuspenseQuery({
		queryKey: ["overview-cards", filters],
		queryFn: () => getOverviewCards({ data: { filters } }),
		staleTime: 30_000,
	});

	const costOverTime = useQuery({
		queryKey: ["cost-over-time", filters],
		queryFn: () => getCostOverTime({ data: { filters } }),
		staleTime: 60_000,
	});

	const modelUsage = useQuery({
		queryKey: ["model-usage", filters],
		queryFn: () => getModelUsage({ data: { filters } }),
		staleTime: 60_000,
	});

	const topProjects = useQuery({
		queryKey: ["top-projects", filters],
		queryFn: () => getTopProjects({ data: { filters } }),
		staleTime: 120_000,
	});

	const thinkingLevels = useQuery({
		queryKey: ["thinking-levels", filters],
		queryFn: () => getThinkingLevels({ data: { filters } }),
		staleTime: 120_000,
	});

	const stopReasons = useQuery({
		queryKey: ["stop-reasons", filters],
		queryFn: () => getStopReasons({ data: { filters } }),
		staleTime: 120_000,
	});

	return (
		<Overview
			cards={cards.data}
			costOverTime={costOverTime.data}
			modelUsage={modelUsage.data}
			topProjects={topProjects.data}
			thinkingLevels={thinkingLevels.data}
			stopReasons={stopReasons.data}
			isLoading={{
				costOverTime: costOverTime.isLoading,
				modelUsage: modelUsage.isLoading,
				topProjects: topProjects.isLoading,
				thinkingLevels: thinkingLevels.isLoading,
				stopReasons: stopReasons.isLoading,
			}}
		/>
	);
}

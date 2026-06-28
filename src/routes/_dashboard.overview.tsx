import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Overview } from "~/features/dashboard/overview";
import { OverviewRpc } from "~/server/rpc/dashboard/overview";

export const Route = createFileRoute("/_dashboard/overview")({
	component: OverviewRoute,
});

function OverviewRoute() {
	const filters = Route.useSearch();

	const cards = useQuery(OverviewRpc.overviewCards(filters));
	const costOverTime = useQuery(OverviewRpc.costOverTime(filters));
	const modelUsage = useQuery(OverviewRpc.modelUsage(filters));
	const topProjects = useQuery(OverviewRpc.topProjects(filters));
	const thinkingLevels = useQuery(OverviewRpc.thinkingLevels(filters));
	const stopReasons = useQuery(OverviewRpc.stopReasons(filters));

	return (
		<Overview
			cards={cards.data!}
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

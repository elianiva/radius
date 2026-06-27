import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { HealthDashboard } from "~/features/dashboard/health";
import { OverviewLoading } from "~/features/dashboard/loading";
import { useDashboardFilters } from "~/hooks/use-dashboard-filters";
import { HealthRpc } from "~/server/rpc/dashboard/health";

export const Route = createFileRoute("/_dashboard/health")({
	component: HealthRoute,
});

function HealthRoute() {
	const filters = useDashboardFilters(Route.useSearch());

	const summary = useQuery(HealthRpc.summary(filters));
	const errorTrend = useQuery(HealthRpc.errorTrend(filters));
	const errorRateByProject = useQuery(HealthRpc.errorRateByProject(filters));
	const toolErrors = useQuery(HealthRpc.toolErrors(filters));

	return (
		<Suspense fallback={<OverviewLoading />}>
			<HealthDashboard
				filters={filters}
				summary={summary.data}
				errorTrend={errorTrend.data}
				errorRateByProject={errorRateByProject.data}
				toolErrors={toolErrors.data}
				isLoading={{
					summary: summary.isLoading,
					errorTrend: errorTrend.isLoading,
					errorRateByProject: errorRateByProject.isLoading,
					toolErrors: toolErrors.isLoading,
				}}
			/>
		</Suspense>
	);
}

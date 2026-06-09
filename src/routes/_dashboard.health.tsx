import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, Suspense } from "react";
import { HealthDashboard } from "~/features/dashboard/health";
import type { DashboardFilters } from "~/features/dashboard/services/filters";
import { OverviewLoading } from "~/features/dashboard/loading";
import {
	getHealthSummary,
	getErrorTrend,
	getToolErrors,
	getErrorRateByProject,
} from "~/server/rpc/dashboard/health";

export const Route = createFileRoute("/_dashboard/health")({
	component: HealthRoute,
});

function useFiltersFromSearch(): DashboardFilters | undefined {
	const search = Route.useSearch();
	return useMemo(() => {
		const f: DashboardFilters = {};
		let hasAny = false;
		if (search.dateFrom != null) {
			f.dateFrom = search.dateFrom;
			hasAny = true;
		}
		if (search.dateTo != null) {
			f.dateTo = search.dateTo;
			hasAny = true;
		}
		if (search.projectIds?.length) {
			f.projectIds = search.projectIds;
			hasAny = true;
		}
		if (search.model) {
			f.model = search.model;
			hasAny = true;
		}
		return hasAny ? f : undefined;
	}, [search.dateFrom, search.dateTo, search.projectIds, search.model]);
}

function HealthRoute() {
	const filters = useFiltersFromSearch();

	const summary = useQuery({
		queryKey: ["health-summary", filters],
		queryFn: () => getHealthSummary({ data: { filters } }),
		staleTime: 30_000,
	});

	const errorTrend = useQuery({
		queryKey: ["error-trend", filters],
		queryFn: () => getErrorTrend({ data: { filters } }),
		staleTime: 60_000,
	});

	const errorRateByProject = useQuery({
		queryKey: ["error-rate-by-project", filters],
		queryFn: () => getErrorRateByProject({ data: { filters } }),
		staleTime: 60_000,
	});

	const toolErrors = useQuery({
		queryKey: ["tool-errors", filters],
		queryFn: () => getToolErrors({ data: { filters } }),
		staleTime: 120_000,
	});

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

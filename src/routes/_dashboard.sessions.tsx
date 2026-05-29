import { createFileRoute, useSearch } from "@tanstack/react-router";
import { Suspense, useMemo } from "react";
import { Sessions } from "~/features/dashboard/sessions";
import { SessionsTableLoading } from "~/features/dashboard/loading";
import type { DashboardFilters } from "~/features/dashboard/services/filters";

export const Route = createFileRoute("/_dashboard/sessions")({
	component: SessionsRoute,
});

function SessionsRoute() {
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

	return (
		<Suspense fallback={<SessionsTableLoading rows={10} />}>
			<Sessions filters={filters} />
		</Suspense>
	);
}

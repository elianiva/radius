import { useMemo } from "react";
import type { DashboardFilters } from "~/features/dashboard/services/filters";

export function useDashboardFilters(
	search: Record<string, unknown>,
): DashboardFilters | undefined {
	return useMemo(() => {
		const f: DashboardFilters = {};
		let hasAny = false;
		if (search.dateFrom != null) {
			f.dateFrom = search.dateFrom as number;
			hasAny = true;
		}
		if (search.dateTo != null) {
			f.dateTo = search.dateTo as number;
			hasAny = true;
		}
		if (Array.isArray(search.projectIds) && search.projectIds.length > 0) {
			f.projectIds = search.projectIds as string[];
			hasAny = true;
		}
		if (typeof search.model === "string" && search.model.length > 0) {
			f.model = search.model;
			hasAny = true;
		}
		return hasAny ? f : undefined;
	}, [search.dateFrom, search.dateTo, search.projectIds, search.model]);
}

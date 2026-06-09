import { sql, type SQL } from "drizzle-orm";
import { sessionSummary } from "~/db/schema";

export interface DashboardFilters {
	dateFrom?: number;
	dateTo?: number;
	projectIds?: string[];
	model?: string;
}

export function applySummaryFilters(filters?: DashboardFilters): SQL[] {
	const conditions: SQL[] = [];
	if (!filters) return conditions;

	if (filters.dateFrom != null) {
		conditions.push(sql`${sessionSummary.createdAt} >= ${filters.dateFrom}`);
	}
	if (filters.dateTo != null) {
		conditions.push(sql`${sessionSummary.createdAt} < ${filters.dateTo}`);
	}
	if (filters.projectIds?.length) {
		conditions.push(
			sql`${sessionSummary.projectId} IN (${sql.join(
				filters.projectIds.map((id) => sql`${id}`),
				sql`,`,
			)})`,
		);
	}
	if (filters.model) {
		conditions.push(sql`${sessionSummary.models} LIKE '%"' || ${filters.model} || '"%'`);
	}

	return conditions;
}

// Drizzle .where() narrows the type so iterative chaining breaks.
// We cast to keep the original builder shape across multiple where calls.
export function withFilters<T>(base: T, conditions: SQL[]): T {
	let result = base as any;
	for (const c of conditions) result = result.where(c);
	return result as T;
}

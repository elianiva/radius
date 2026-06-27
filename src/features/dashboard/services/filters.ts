import { sql, type SQL } from "drizzle-orm";
import { sessionSummary } from "~/db/schema";

export interface DashboardFilters {
	dateFrom?: number;
	dateTo?: number;
	projectIds?: string[];
	model?: string;
}

export function parseFilters(raw: unknown): DashboardFilters | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const obj = raw as Record<string, unknown>;
	const result: DashboardFilters = {};
	if (typeof obj.dateFrom === "number") result.dateFrom = obj.dateFrom;
	if (typeof obj.dateTo === "number") result.dateTo = obj.dateTo;
	if (Array.isArray(obj.projectIds) && obj.projectIds.length > 0) {
		result.projectIds = obj.projectIds as string[];
	}
	if (typeof obj.model === "string" && obj.model.length > 0) {
		result.model = obj.model;
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

export function extractFilters(v: unknown): { filters: DashboardFilters | undefined } {
	if (!v || typeof v !== "object") return { filters: undefined };
	const raw = (v as Record<string, unknown>).data;
	return { filters: parseFilters(raw) };
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

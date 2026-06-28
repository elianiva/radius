import { Schema } from "effect";
import { sql, type SQL } from "drizzle-orm";
import { sessionSummary } from "~/db/schema";

export const DashboardFiltersSchema = Schema.Struct({
	dateFrom: Schema.optional(Schema.Number),
	dateTo: Schema.optional(Schema.Number),
	projectIds: Schema.optional(Schema.Array(Schema.String)),
	model: Schema.optional(Schema.String),
});

export type DashboardFilters = typeof DashboardFiltersSchema.Type;

const decodeFilters = Schema.decodeUnknownSync(DashboardFiltersSchema);

/** Unwrap RPC envelope { data: { filters } } and validate the inner shape. */
export function extractFilters(v: unknown): { filters: DashboardFilters | undefined } {
	if (!v || typeof v !== "object") return { filters: undefined };
	const raw = (v as Record<string, unknown>).data;
	const result = decodeFilters(raw);
	return { filters: Object.keys(result).length > 0 ? result : undefined };
}

/** Unwrap a { data: { filters, ...rest } } envelope with cursor support. */
export function extractFiltersWithCursor(v: unknown): {
	filters: DashboardFilters | undefined;
	cursor: string | undefined;
} {
	if (!v || typeof v !== "object") return { cursor: undefined, filters: undefined };
	const raw = (v as Record<string, unknown>).data as Record<string, unknown> | undefined;
	const filters = decodeFilters(raw?.filters);
	return {
		cursor: raw?.cursor as string | undefined,
		filters: Object.keys(filters).length > 0 ? filters : undefined,
	};
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

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { HealthService } from "~/features/dashboard/services/health";
import type { DashboardFilters } from "~/features/dashboard/services/filters";

function parseFilters(raw: unknown): DashboardFilters | undefined {
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

function extractFilters(v: unknown): { filters: DashboardFilters | undefined } {
	if (!v || typeof v !== "object") return { filters: undefined };
	const raw = (v as Record<string, unknown>).data;
	return { filters: parseFilters(raw) };
}

export const getHealthSummary = createServerFn({ method: "GET" })
	.inputValidator(extractFilters)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getSummary(data.filters)),
			{ signal: getRequest().signal },
		),
	);

export const getErrorTrend = createServerFn({ method: "GET" })
	.inputValidator(extractFilters)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getErrorTrend(data.filters)),
			{ signal: getRequest().signal },
		),
	);

export const getToolErrors = createServerFn({ method: "GET" })
	.inputValidator(extractFilters)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getToolErrors(data.filters)),
			{ signal: getRequest().signal },
		),
	);

export const getErrorRateByProject = createServerFn({ method: "GET" })
	.inputValidator(extractFilters)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getErrorRateByProject(data.filters)),
			{ signal: getRequest().signal },
		),
	);

export const getExpensiveSessions = createServerFn({ method: "GET" })
	.inputValidator((v: unknown) => {
		if (!v || typeof v !== "object") return { cursor: undefined, filters: undefined };
		const raw = (v as Record<string, unknown>).data as Record<string, unknown> | undefined;
		return { cursor: raw?.cursor as string | undefined, filters: raw?.filters as DashboardFilters | undefined };
	})
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getExpensiveSessions(data.filters, data.cursor)),
			{ signal: getRequest().signal },
		),
	);

export const getHighTokenSessions = createServerFn({ method: "GET" })
	.inputValidator((v: unknown) => {
		if (!v || typeof v !== "object") return { cursor: undefined, filters: undefined };
		const raw = (v as Record<string, unknown>).data as Record<string, unknown> | undefined;
		return { cursor: raw?.cursor as string | undefined, filters: raw?.filters as DashboardFilters | undefined };
	})
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getHighTokenSessions(data.filters, data.cursor)),
			{ signal: getRequest().signal },
		),
	);

export const getErrorProneSessions = createServerFn({ method: "GET" })
	.inputValidator((v: unknown) => {
		if (!v || typeof v !== "object") return { cursor: undefined, filters: undefined };
		const raw = (v as Record<string, unknown>).data as Record<string, unknown> | undefined;
		return { cursor: raw?.cursor as string | undefined, filters: raw?.filters as DashboardFilters | undefined };
	})
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getErrorProneSessions(data.filters, data.cursor)),
			{ signal: getRequest().signal },
		),
	);

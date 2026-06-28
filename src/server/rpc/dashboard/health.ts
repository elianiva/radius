import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { HealthService } from "~/features/dashboard/services/health";
import { extractFilters, extractFiltersWithCursor } from "~/features/dashboard/services/filters";
import type { DashboardFilters } from "~/features/dashboard/services/filters";

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
	.inputValidator(extractFiltersWithCursor)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getExpensiveSessions(data.filters, data.cursor)),
			{ signal: getRequest().signal },
		),
	);

export const getHighTokenSessions = createServerFn({ method: "GET" })
	.inputValidator(extractFiltersWithCursor)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getHighTokenSessions(data.filters, data.cursor)),
			{ signal: getRequest().signal },
		),
	);

export const getErrorProneSessions = createServerFn({ method: "GET" })
	.inputValidator(extractFiltersWithCursor)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getErrorProneSessions(data.filters, data.cursor)),
			{ signal: getRequest().signal },
		),
	);

export const HealthRpc = {
	health: () => ["dashboard", "health"] as const,
	summary: (filters?: DashboardFilters) =>
		queryOptions({
			queryKey: [...HealthRpc.health(), "summary", filters] as const,
			queryFn: () => getHealthSummary({ data: { filters } }),
			staleTime: 30_000,
		}),
	errorTrend: (filters?: DashboardFilters) =>
		queryOptions({
			queryKey: [...HealthRpc.health(), "error-trend", filters] as const,
			queryFn: () => getErrorTrend({ data: { filters } }),
			staleTime: 60_000,
		}),
	errorRateByProject: (filters?: DashboardFilters) =>
		queryOptions({
			queryKey: [...HealthRpc.health(), "error-rate-by-project", filters] as const,
			queryFn: () => getErrorRateByProject({ data: { filters } }),
			staleTime: 60_000,
		}),
	toolErrors: (filters?: DashboardFilters) =>
		queryOptions({
			queryKey: [...HealthRpc.health(), "tool-errors", filters] as const,
			queryFn: () => getToolErrors({ data: { filters } }),
			staleTime: 120_000,
		}),
	expensiveSessions: (filters?: DashboardFilters, cursor?: string) =>
		queryOptions({
			queryKey: [...HealthRpc.health(), "expensive-sessions", filters, cursor] as const,
			queryFn: () => getExpensiveSessions({ data: { filters, cursor } }),
			staleTime: 60_000,
		}),
	highTokenSessions: (filters?: DashboardFilters, cursor?: string) =>
		queryOptions({
			queryKey: [...HealthRpc.health(), "high-token-sessions", filters, cursor] as const,
			queryFn: () => getHighTokenSessions({ data: { filters, cursor } }),
			staleTime: 60_000,
		}),
	errorProneSessions: (filters?: DashboardFilters, cursor?: string) =>
		queryOptions({
			queryKey: [...HealthRpc.health(), "error-prone-sessions", filters, cursor] as const,
			queryFn: () => getErrorProneSessions({ data: { filters, cursor } }),
			staleTime: 60_000,
		}),
};

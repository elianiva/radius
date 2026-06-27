import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { OverviewService } from "~/features/dashboard/services/overview";
import { extractFilters } from "~/features/dashboard/services/filters";
import type { DashboardFilters } from "~/features/dashboard/services/filters";

export const getOverviewCards = createServerFn({ method: "GET" })
	.inputValidator(extractFilters)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			OverviewService.use((svc) => svc.getCards(data.filters)),
			{ signal: getRequest().signal },
		),
	);

export const getCostOverTime = createServerFn({ method: "GET" })
	.inputValidator(extractFilters)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			OverviewService.use((svc) => svc.getCostOverTime(data.filters)),
			{ signal: getRequest().signal },
		),
	);

export const getModelUsage = createServerFn({ method: "GET" })
	.inputValidator(extractFilters)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			OverviewService.use((svc) => svc.getModelUsage(data.filters)),
			{ signal: getRequest().signal },
		),
	);

export const getTopProjects = createServerFn({ method: "GET" })
	.inputValidator(extractFilters)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			OverviewService.use((svc) => svc.getTopProjects(data.filters)),
			{ signal: getRequest().signal },
		),
	);

export const getThinkingLevels = createServerFn({ method: "GET" })
	.inputValidator(extractFilters)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			OverviewService.use((svc) => svc.getThinkingLevels(data.filters)),
			{ signal: getRequest().signal },
		),
	);

export const getStopReasons = createServerFn({ method: "GET" })
	.inputValidator(extractFilters)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			OverviewService.use((svc) => svc.getStopReasons(data.filters)),
			{ signal: getRequest().signal },
		),
	);

export const getDashboardMetrics = createServerFn({ method: "GET" })
	.inputValidator(extractFilters)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			OverviewService.use((svc) => svc.getDashboardMetrics(data.filters)),
			{ signal: getRequest().signal },
		),
	);

export const OverviewRpc = {
	dashboard: () => ["dashboard"] as const,
	overviewCards: (filters?: DashboardFilters) =>
		queryOptions({
			queryKey: [...OverviewRpc.dashboard(), "overview-cards", filters] as const,
			queryFn: () => getOverviewCards({ data: { filters } }),
			staleTime: 30_000,
		}),
	costOverTime: (filters?: DashboardFilters) =>
		queryOptions({
			queryKey: [...OverviewRpc.dashboard(), "cost-over-time", filters] as const,
			queryFn: () => getCostOverTime({ data: { filters } }),
			staleTime: 60_000,
		}),
	modelUsage: (filters?: DashboardFilters) =>
		queryOptions({
			queryKey: [...OverviewRpc.dashboard(), "model-usage", filters] as const,
			queryFn: () => getModelUsage({ data: { filters } }),
			staleTime: 60_000,
		}),
	topProjects: (filters?: DashboardFilters) =>
		queryOptions({
			queryKey: [...OverviewRpc.dashboard(), "top-projects", filters] as const,
			queryFn: () => getTopProjects({ data: { filters } }),
			staleTime: 120_000,
		}),
	thinkingLevels: (filters?: DashboardFilters) =>
		queryOptions({
			queryKey: [...OverviewRpc.dashboard(), "thinking-levels", filters] as const,
			queryFn: () => getThinkingLevels({ data: { filters } }),
			staleTime: 120_000,
		}),
	stopReasons: (filters?: DashboardFilters) =>
		queryOptions({
			queryKey: [...OverviewRpc.dashboard(), "stop-reasons", filters] as const,
			queryFn: () => getStopReasons({ data: { filters } }),
			staleTime: 120_000,
		}),
	dashboardMetrics: (filters?: DashboardFilters) =>
		queryOptions({
			queryKey: [...OverviewRpc.dashboard(), "metrics", filters] as const,
			queryFn: () => getDashboardMetrics({ data: { filters } }),
			staleTime: 120_000,
		}),
};

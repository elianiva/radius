import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { OverviewService } from "~/features/dashboard/services/overview";
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

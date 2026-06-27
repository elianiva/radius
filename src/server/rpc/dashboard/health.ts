import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { HealthService } from "~/features/dashboard/services/health";
import { extractFilters, parseFilters } from "~/features/dashboard/services/filters";

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
		return { cursor: raw?.cursor as string | undefined, filters: parseFilters(raw?.filters) };
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
		return { cursor: raw?.cursor as string | undefined, filters: parseFilters(raw?.filters) };
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
		return { cursor: raw?.cursor as string | undefined, filters: parseFilters(raw?.filters) };
	})
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getErrorProneSessions(data.filters, data.cursor)),
			{ signal: getRequest().signal },
		),
	);

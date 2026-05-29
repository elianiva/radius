import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { HealthService } from "~/features/dashboard/services/health";

export const getHealthSummary = createServerFn({ method: "GET" }).handler(() =>
	AppRuntime.runPromise(
		HealthService.use((svc) => svc.getSummary()),
		{ signal: getRequest().signal },
	),
);

export const getErrorTrend = createServerFn({ method: "GET" }).handler(() =>
	AppRuntime.runPromise(
		HealthService.use((svc) => svc.getErrorTrend()),
		{ signal: getRequest().signal },
	),
);

export const getToolErrors = createServerFn({ method: "GET" }).handler(() =>
	AppRuntime.runPromise(
		HealthService.use((svc) => svc.getToolErrors()),
		{ signal: getRequest().signal },
	),
);

export const getErrorRateByProject = createServerFn({ method: "GET" }).handler(() =>
	AppRuntime.runPromise(
		HealthService.use((svc) => svc.getErrorRateByProject()),
		{ signal: getRequest().signal },
	),
);

export const getExpensiveSessions = createServerFn({ method: "GET" })
	.inputValidator((v: unknown) => v as { cursor?: string })
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getExpensiveSessions(data.cursor)),
			{ signal: getRequest().signal },
		),
	);

export const getHighTokenSessions = createServerFn({ method: "GET" })
	.inputValidator((v: unknown) => v as { cursor?: string })
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getHighTokenSessions(data.cursor)),
			{ signal: getRequest().signal },
		),
	);

export const getErrorProneSessions = createServerFn({ method: "GET" })
	.inputValidator((v: unknown) => v as { cursor?: string })
	.handler(({ data }) =>
		AppRuntime.runPromise(
			HealthService.use((svc) => svc.getErrorProneSessions(data.cursor)),
			{ signal: getRequest().signal },
		),
	);

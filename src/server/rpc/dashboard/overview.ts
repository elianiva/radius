import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { OverviewService } from "~/features/dashboard/services/overview";

export const getOverviewCards = createServerFn({ method: "GET" }).handler(() =>
	AppRuntime.runPromise(
		OverviewService.use((svc) => svc.getCards()),
		{ signal: getRequest().signal },
	),
);

export const getCostOverTime = createServerFn({ method: "GET" }).handler(() =>
	AppRuntime.runPromise(
		OverviewService.use((svc) => svc.getCostOverTime()),
		{ signal: getRequest().signal },
	),
);

export const getModelUsage = createServerFn({ method: "GET" }).handler(() =>
	AppRuntime.runPromise(
		OverviewService.use((svc) => svc.getModelUsage()),
		{ signal: getRequest().signal },
	),
);

export const getTopProjects = createServerFn({ method: "GET" }).handler(() =>
	AppRuntime.runPromise(
		OverviewService.use((svc) => svc.getTopProjects()),
		{ signal: getRequest().signal },
	),
);

export const getThinkingLevels = createServerFn({ method: "GET" }).handler(() =>
	AppRuntime.runPromise(
		OverviewService.use((svc) => svc.getThinkingLevels()),
		{ signal: getRequest().signal },
	),
);

export const getStopReasons = createServerFn({ method: "GET" }).handler(() =>
	AppRuntime.runPromise(
		OverviewService.use((svc) => svc.getStopReasons()),
		{ signal: getRequest().signal },
	),
);

export const getDashboardMetrics = createServerFn({ method: "GET" }).handler(() =>
	AppRuntime.runPromise(
		OverviewService.use((svc) => svc.getDashboardMetrics()),
		{ signal: getRequest().signal },
	),
);

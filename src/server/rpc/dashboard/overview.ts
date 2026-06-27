import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { OverviewService } from "~/features/dashboard/services/overview";
import { extractFilters } from "~/features/dashboard/services/filters";

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

import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { SwearService } from "~/features/dashboard/services/swear";
import { extractFilters } from "~/features/dashboard/services/filters";
import type { DashboardFilters } from "~/features/dashboard/services/filters";

export const getSwearMetrics = createServerFn({ method: "GET" })
	.inputValidator(extractFilters)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			SwearService.use((swear) => swear.getSummary(data.filters)),
			{ signal: getRequest().signal },
		),
	);

export const SwearRpc = {
	swearing: () => ["dashboard", "swearing"] as const,
	metrics: (filters?: DashboardFilters) =>
		queryOptions({
			queryKey: [...SwearRpc.swearing(), "metrics", filters] as const,
			queryFn: () => getSwearMetrics({ data: { filters } }),
			staleTime: 120_000,
		}),
};

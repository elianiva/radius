import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { FilterOptionsService } from "~/features/dashboard/services/filter-options";

export const getProjectNames = createServerFn({ method: "GET" }).handler(() =>
	AppRuntime.runPromise(
		FilterOptionsService.use((svc) => svc.getProjectNames()),
		{ signal: getRequest().signal },
	),
);

export const getModelNames = createServerFn({ method: "GET" }).handler(() =>
	AppRuntime.runPromise(
		FilterOptionsService.use((svc) => svc.getModelNames()),
		{ signal: getRequest().signal },
	),
);

export const FilterOptionsRpc = {
	filterOptions: () => ["dashboard", "filter-options"] as const,
	projectNames: () =>
		queryOptions({
			queryKey: [...FilterOptionsRpc.filterOptions(), "project-names"] as const,
			queryFn: () => getProjectNames(),
			staleTime: 120_000,
		}),
	modelNames: () =>
		queryOptions({
			queryKey: [...FilterOptionsRpc.filterOptions(), "model-names"] as const,
			queryFn: () => getModelNames(),
			staleTime: 120_000,
		}),
};

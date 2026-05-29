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

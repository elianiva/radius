import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { SwearService } from "~/features/dashboard/services/swear";
import { extractFilters } from "~/features/dashboard/services/filters";

export const getSwearMetrics = createServerFn({ method: "GET" })
	.inputValidator(extractFilters)
	.handler(({ data }) =>
		AppRuntime.runPromise(
			SwearService.use((swear) => swear.getSummary(data.filters)),
			{ signal: getRequest().signal },
		),
	);

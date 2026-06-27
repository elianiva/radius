import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { SessionsService } from "~/features/dashboard/services/sessions";
import { parseFilters } from "~/features/dashboard/services/filters";

export const getSessionsList = createServerFn({ method: "GET" })
	.inputValidator((v: unknown) => {
		if (!v || typeof v !== "object")
			return { search: undefined, sortBy: undefined, sortDir: undefined, cursor: undefined, filters: undefined };
		const raw = (v as Record<string, unknown>).data as Record<string, unknown> | undefined;
		return {
			search: raw?.search as string | undefined,
			sortBy: raw?.sortBy as string | undefined,
			sortDir: raw?.sortDir as "asc" | "desc" | undefined,
			cursor: raw?.cursor as string | undefined,
			filters: parseFilters(raw?.filters),
		};
	})
	.handler(({ data }) =>
		AppRuntime.runPromise(
			SessionsService.use((svc) => svc.list(data)),
			{ signal: getRequest().signal },
		),
	);

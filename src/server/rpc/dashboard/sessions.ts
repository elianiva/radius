import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { SessionsService } from "~/features/dashboard/services/sessions";
import { parseFilters } from "~/features/dashboard/services/filters";
import type { DashboardFilters } from "~/features/dashboard/services/filters";
import { getSessionEvents } from "../../rpc/sessions";

export const getSessionsList = createServerFn({ method: "GET" })
	.inputValidator((v: unknown) => {
		if (!v || typeof v !== "object")
			return {
				search: undefined,
				sortBy: undefined,
				sortDir: undefined,
				cursor: undefined,
				filters: undefined,
			};
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

export const SessionsRpc = {
	sessions: () => ["dashboard", "sessions"] as const,
	list: (
		search?: string,
		sortBy?: string,
		sortDir?: "asc" | "desc",
		cursor?: string,
		filters?: DashboardFilters,
	) =>
		queryOptions({
			queryKey: [
				...SessionsRpc.sessions(),
				"list",
				search,
				sortBy,
				sortDir,
				cursor,
				filters,
			] as const,
			queryFn: () =>
				getSessionsList({
					data: { search, sortBy, sortDir, cursor, filters },
				}),
			staleTime: 60_000,
		}),
	events: (sessionId: string) =>
		queryOptions({
			queryKey: [...SessionsRpc.sessions(), "events", sessionId] as const,
			queryFn: () => getSessionEvents({ data: { sessionId } }),
		}),
};

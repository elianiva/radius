import { useQuery } from "@tanstack/react-query";
import { FilterOptionsRpc } from "~/server/rpc/dashboard/filters";

export function useFilterOptions() {
	const projects = useQuery(FilterOptionsRpc.projectNames());
	const models = useQuery(FilterOptionsRpc.modelNames());
	return {
		projects: projects.data ?? [],
		models: models.data ?? [],
	};
}

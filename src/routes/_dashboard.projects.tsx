import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Suspense, useState, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { getDashboardMetrics } from "~/server/rpc/dashboard/overview";
import { getProjectDetail } from "~/server/rpc/dashboard/projects";
import { Projects } from "~/features/dashboard/projects";
import { ProjectDetailView } from "~/features/dashboard/project-detail";
import { ProjectsLoading } from "~/features/dashboard/loading";
import type { DashboardFilters } from "~/features/dashboard/services/filters";

import type { ProjectDetail } from "~/features/dashboard/types";

export const Route = createFileRoute("/_dashboard/projects")({
	component: ProjectsRoute,
});

function ProjectsRoute() {
	const search = useSearch({ strict: false });

	const filters: DashboardFilters | undefined = useMemo(() => {
		const f: DashboardFilters = {};
		let hasAny = false;
		if (search.dateFrom != null) { f.dateFrom = search.dateFrom; hasAny = true; }
		if (search.dateTo != null) { f.dateTo = search.dateTo; hasAny = true; }
		if (search.projectIds?.length) { f.projectIds = search.projectIds; hasAny = true; }
		if (search.model) { f.model = search.model; hasAny = true; }
		return hasAny ? f : undefined;
	}, [search.dateFrom, search.dateTo, search.projectIds, search.model]);

	const { data: metrics } = useSuspenseQuery({
		queryKey: ["dashboard-metrics", filters],
		queryFn: () => getDashboardMetrics({ data: { filters } }),
		staleTime: 120_000,
	});

	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

	const { data: projectDetail } = useQuery({
		queryKey: ["project-detail", selectedProjectId],
		queryFn: () => getProjectDetail({ data: { projectId: selectedProjectId! } }),
		staleTime: 60_000,
		enabled: !!selectedProjectId,
	});

	if (selectedProjectId && projectDetail) {
		return (
			<div className="flex flex-col gap-4 animate-in fade-in duration-300">
				<button
					onClick={() => setSelectedProjectId(null)}
					className="inline-flex w-fit items-center gap-1.5 border px-3 py-1.5 text-sm font-medium hover:bg-muted/30"
				>
					<ArrowLeft className="size-4" />
					Back to projects
				</button>
				<ProjectDetailView data={projectDetail as ProjectDetail} />
			</div>
		);
	}

	return (
		<Suspense fallback={<ProjectsLoading />}>
			<Projects projects={metrics.projects} onSelectProject={setSelectedProjectId} />
		</Suspense>
	);
}

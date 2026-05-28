import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getDashboardMetrics } from "~/server/rpc/dashboard";
import { Projects } from "~/features/dashboard/projects";

export const Route = createFileRoute("/_dashboard/projects")({
  component: ProjectsRoute,
});

function ProjectsRoute() {
  const { data: metrics } = useSuspenseQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: () => getDashboardMetrics(),
    staleTime: 60_000,
  });

  return <Projects projects={metrics.projects} />;
}

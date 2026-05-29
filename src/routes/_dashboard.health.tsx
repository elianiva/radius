import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HealthDashboard } from "~/features/dashboard/health";
import {
  getHealthSummary,
  getErrorTrend,
  getToolErrors,
  getErrorRateByProject,
} from "~/server/rpc/dashboard";

export const Route = createFileRoute("/_dashboard/health")({
  component: HealthRoute,
});

function HealthRoute() {
  const summary = useQuery({
    queryKey: ["health-summary"],
    queryFn: () => getHealthSummary(),
    staleTime: 30_000,
  });

  const errorTrend = useQuery({
    queryKey: ["error-trend"],
    queryFn: () => getErrorTrend(),
    staleTime: 60_000,
  });

  const errorRateByProject = useQuery({
    queryKey: ["error-rate-by-project"],
    queryFn: () => getErrorRateByProject(),
    staleTime: 60_000,
  });

  const toolErrors = useQuery({
    queryKey: ["tool-errors"],
    queryFn: () => getToolErrors(),
    staleTime: 120_000,
  });

  return (
    <HealthDashboard
      summary={summary.data}
      errorTrend={errorTrend.data}
      errorRateByProject={errorRateByProject.data}
      toolErrors={toolErrors.data}
      isLoading={{
        summary: summary.isLoading,
        errorTrend: errorTrend.isLoading,
        errorRateByProject: errorRateByProject.isLoading,
        toolErrors: toolErrors.isLoading,
      }}
    />
  );
}

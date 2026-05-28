import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Overview } from "~/features/dashboard/overview";

import {
  getOverviewCards,
  getCostOverTime,
  getModelUsage,
  getTopProjects,
  getThinkingLevels,
  getStopReasons,
} from "~/server/rpc/dashboard";

export const Route = createFileRoute("/_dashboard/overview")({
  component: OverviewRoute,
});

function OverviewRoute() {
  const cards = useSuspenseQuery({
    queryKey: ["overview-cards"],
    queryFn: () => getOverviewCards(),
    staleTime: 30_000,
  });

  const costOverTime = useQuery({
    queryKey: ["cost-over-time"],
    queryFn: () => getCostOverTime(),
    staleTime: 60_000,
  });

  const modelUsage = useQuery({
    queryKey: ["model-usage"],
    queryFn: () => getModelUsage(),
    staleTime: 60_000,
  });

  const topProjects = useQuery({
    queryKey: ["top-projects"],
    queryFn: () => getTopProjects(),
    staleTime: 120_000,
  });

  const thinkingLevels = useQuery({
    queryKey: ["thinking-levels"],
    queryFn: () => getThinkingLevels(),
    staleTime: 120_000,
  });

  const stopReasons = useQuery({
    queryKey: ["stop-reasons"],
    queryFn: () => getStopReasons(),
    staleTime: 120_000,
  });

  return (
    <Overview
      cards={cards.data}
      costOverTime={costOverTime.data}
      modelUsage={modelUsage.data}
      topProjects={topProjects.data}
      thinkingLevels={thinkingLevels.data}
      stopReasons={stopReasons.data}
      isLoading={{
        costOverTime: costOverTime.isLoading,
        modelUsage: modelUsage.isLoading,
        topProjects: topProjects.isLoading,
        thinkingLevels: thinkingLevels.isLoading,
        stopReasons: stopReasons.isLoading,
      }}
    />
  );
}

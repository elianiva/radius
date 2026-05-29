import { createServerFn } from "@tanstack/react-start";

import { AppRuntime } from "../../app-runtime";
import { OverviewService } from "~/features/dashboard/services/overview";

export const getOverviewCards = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(OverviewService.use((svc) => svc.getCards())),
);

export const getCostOverTime = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(OverviewService.use((svc) => svc.getCostOverTime())),
);

export const getModelUsage = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(OverviewService.use((svc) => svc.getModelUsage())),
);

export const getTopProjects = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(OverviewService.use((svc) => svc.getTopProjects())),
);

export const getThinkingLevels = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(OverviewService.use((svc) => svc.getThinkingLevels())),
);

export const getStopReasons = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(OverviewService.use((svc) => svc.getStopReasons())),
);

export const getDashboardMetrics = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(OverviewService.use((svc) => svc.getDashboardMetrics())),
);

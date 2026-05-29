import { createServerFn } from "@tanstack/react-start";

import { AppRuntime } from "../../app-runtime";
import { HealthService } from "~/features/dashboard/services/health";

export const getHealthSummary = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(HealthService.use((svc) => svc.getSummary())),
);

export const getErrorTrend = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(HealthService.use((svc) => svc.getErrorTrend())),
);

export const getToolErrors = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(HealthService.use((svc) => svc.getToolErrors())),
);

export const getErrorRateByProject = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(HealthService.use((svc) => svc.getErrorRateByProject())),
);

export const getExpensiveSessions = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { cursor?: string })
  .handler(({ data }) =>
    AppRuntime.runPromise(HealthService.use((svc) => svc.getExpensiveSessions(data.cursor))),
  );

export const getHighTokenSessions = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { cursor?: string })
  .handler(({ data }) =>
    AppRuntime.runPromise(HealthService.use((svc) => svc.getHighTokenSessions(data.cursor))),
  );

export const getErrorProneSessions = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { cursor?: string })
  .handler(({ data }) =>
    AppRuntime.runPromise(HealthService.use((svc) => svc.getErrorProneSessions(data.cursor))),
  );

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { SwearService } from "~/features/dashboard/services/swear";

export const getSwearMetrics = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(SwearService.use((swear) => swear.getSummary()), { signal: getRequest().signal }),
);

import { createServerFn } from "@tanstack/react-start";

import { AppRuntime } from "../../app-runtime";
import { SwearService } from "~/features/dashboard/services/swear";

export const getSwearMetrics = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(SwearService.use((swear) => swear.getSummary())),
);

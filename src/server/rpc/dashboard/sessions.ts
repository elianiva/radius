import { createServerFn } from "@tanstack/react-start";

import { AppRuntime } from "../../app-runtime";
import { SessionsService } from "~/features/dashboard/services/sessions";

export const getSessionsList = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { search?: string; sortBy?: string; sortDir?: "asc" | "desc"; cursor?: string })
  .handler(({ data }) =>
    AppRuntime.runPromise(SessionsService.use((svc) => svc.list(data))),
  );

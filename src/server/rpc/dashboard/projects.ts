import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../../app-runtime";
import { ProjectService } from "~/features/dashboard/services/projects";

export const getProjectDetail = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { projectId: string })
  .handler(({ data }) =>
    AppRuntime.runPromise(ProjectService.use((svc) => svc.getDetail(data.projectId)), { signal: getRequest().signal }),
  );

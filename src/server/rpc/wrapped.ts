import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { AppRuntime } from "../app-runtime";
import { WrappedService } from "~/features/wrapped/services/wrapped";

export const getWrappedData = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { year?: number })
  .handler(({ data }) =>
    AppRuntime.runPromise(
      WrappedService.use((svc) => svc.getAll(data.year)),
      { signal: getRequest().signal },
    ),
  );

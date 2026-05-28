import { createServerFn } from "@tanstack/react-start";
import { Effect, Stream } from "effect";

import { AppRuntime } from "../app-runtime";
import { PiAdapterService, type IngestProgress } from "~/features/sessions/adapters/pi";
import { SessionService } from "~/features/sessions/services/session";

export const importPiSessions = createServerFn({ method: "POST" }).handler(async function* () {
  const stream = await AppRuntime.runPromise(PiAdapterService.use((pi) => pi.ingest));
  const context = await AppRuntime.context();

  const readable = Stream.toReadableStreamWith(stream, context);
  const reader = readable.getReader();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      yield value as IngestProgress;
    }
  } finally {
    reader.releaseLock();
  }
});

export const getSessionEvents = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { sessionId: string })
  .handler(({ data }) =>
    AppRuntime.runPromise(
      Effect.gen(function* () {
        const result = yield* SessionService.use((svc) =>
          svc.getEvents({ sessionId: data.sessionId }),
        );
        return result;
      }),
    ),
  );

export const getSessionsList = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { cursor?: string })
  .handler(({ data }) =>
    AppRuntime.runPromise(
      Effect.gen(function* () {
        yield* Effect.logInfo("getSessionsList: Listing").pipe(
          Effect.annotateLogs({
            operation: "getSessionsList",
            cursor: data.cursor ?? null,
          }),
        );
        const result = yield* SessionService.use((svc) => svc.list({ cursor: data.cursor }));
        yield* Effect.logInfo("getSessionsList: Returning").pipe(
          Effect.annotateLogs({
            operation: "getSessionsList",
            count: result.items.length,
            hasMore: result.cursor !== null,
          }),
        );
        return result;
      }),
    ),
  );

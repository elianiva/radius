import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Stream } from "effect";

import { AppRuntime } from "../app-runtime";
import { IngestService } from "~/features/sessions/service";
import type { IngestProgress } from "~/features/sessions/progress";
import { SessionService } from "~/features/sessions/services/session";

export const importPiSessions = createServerFn({ method: "POST" }).handler(async function* () {
  const { signal } = getRequest();
  const ingest = await AppRuntime.runPromise(
    IngestService.use((svc) => svc.ingestPi),
    { signal },
  );
  const context = await AppRuntime.context();

  const readable = Stream.toReadableStreamWith(ingest, context);
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

export const importOpencodeSessions = createServerFn({ method: "POST" }).handler(async function* () {
  const { signal } = getRequest();
  const stream = await AppRuntime.runPromise(
    IngestService.use((svc) => svc.ingestOpencode),
    { signal },
  );
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
      SessionService.use((svc) => svc.getEvents({ sessionId: data.sessionId })),
      { signal: getRequest().signal },
    ),
  );

export const getSessionsList = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { cursor?: string })
  .handler(({ data }) =>
    AppRuntime.runPromise(
      SessionService.use((svc) => svc.list({ cursor: data.cursor })),
      { signal: getRequest().signal },
    ),
  );

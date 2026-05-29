import { createServerFn } from "@tanstack/react-start";
import { Effect, Layer } from "effect";

import { AppRuntime } from "../../app-runtime";
import { Database } from "~/db/service";
import { session, project } from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  SessionService,
  SessionError,
} from "~/features/sessions/services/session";
import { PlatformLayer } from "../../app-layer";
import { paginateExtendedSessions } from "./shared";

function filterAndSortSessions(
  sessions: Parameters<typeof paginateExtendedSessions>[0],
  search?: string,
  sortBy?: string,
  sortDir?: "asc" | "desc",
  cursor?: string,
) {
  let filtered = sessions;

  if (search) {
    const q = search.toLowerCase();
    filtered = sessions.filter(
      (s) =>
        (s.title ?? "").toLowerCase().includes(q) ||
        s.projectName.toLowerCase().includes(q) ||
        s.models.some((m) => m.toLowerCase().includes(q)),
    );
  }

  const sortFn = (a: typeof sessions[number], b: typeof sessions[number]): number => {
    let cmp = 0;
    switch (sortBy) {
      case "createdAt":
        cmp = a.createdAt - b.createdAt;
        break;
      case "duration":
        cmp = a.duration - b.duration;
        break;
      case "totalCost":
        cmp = a.totalCost - b.totalCost;
        break;
      case "totalTokens":
        cmp = a.totalTokens - b.totalTokens;
        break;
      case "messageCount":
        cmp = a.messageCount - b.messageCount;
        break;
      case "toolErrorCount":
        cmp = a.toolErrorCount - b.toolErrorCount;
        break;
      default:
        cmp = a.createdAt - b.createdAt;
    }
    return sortDir === "asc" ? cmp : -cmp;
  };

  return paginateExtendedSessions(filtered, sortFn, cursor);
}

export const getSessionsMetrics = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { cursor?: string })
  .handler(({ data }) =>
    AppRuntime.runPromise(
      Effect.gen(function*() {
        const db = yield* Database;
        const svc = yield* SessionService;

        const result = yield* svc.list({ cursor: data.cursor });

        const projectRows = db.select().from(project).all();
        const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name]));

        const metrics = yield* Effect.all(
          result.items.map((sess) =>
            svc.computeSessionMetrics({
              session: sess,
              projectName: projectNameMap.get(sess.projectId) ?? "Unknown",
            }),
          ),
          { concurrency: 10 },
        );

        return { items: metrics, cursor: result.cursor };
      }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
    ),
  );

export const getSessionsList = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { search?: string; sortBy?: string; sortDir?: "asc" | "desc"; cursor?: string })
  .handler(({ data }) =>
    AppRuntime.runPromise(
      Effect.gen(function*() {
        const db = yield* Database;
        const svc = yield* SessionService;

        const sessionRows = db.select().from(session).all();
        const projectRows = db.select().from(project).all();
        const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name]));

        const allMetrics = yield* Effect.all(
          sessionRows.map((sess) =>
            svc.computeSessionMetrics({
              session: sess,
              projectName: projectNameMap.get(sess.projectId) ?? "Unknown",
            }),
          ),
          { concurrency: 10 },
        );

        return filterAndSortSessions(
          allMetrics,
          data.search,
          data.sortBy,
          data.sortDir,
          data.cursor,
        );
      }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
    ),
  );

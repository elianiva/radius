import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import { session, project } from "~/db/schema";
import {
  SessionService,
  type SessionMetrics,
} from "~/features/sessions/services/session";
import type { ExtendedSession, PaginatedSessions } from "./health";

export class SessionsError extends Data.TaggedError("SessionsError")<{
  readonly cause: unknown;
  readonly message: string;
}> {}

interface SessionsServiceShape {
  readonly list: (params: {
    search?: string;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    cursor?: string;
  }) => Effect.Effect<PaginatedSessions, SessionsError>;
}

function toExtendedSession(s: SessionMetrics): ExtendedSession {
  return {
    id: s.id,
    projectName: s.projectName,
    title: s.title,
    duration: s.duration,
    totalCost: s.totalCost,
    totalTokens: s.totalTokens,
    models: s.models,
    messageCount: s.messageCount,
    toolCallCount: s.toolCallCount,
    toolErrorCount: s.toolErrorCount,
    createdAt: s.createdAt,
  };
}

const PAGE_SIZE = 15;

function paginate(
  sessions: SessionMetrics[],
  sortFn: (a: SessionMetrics, b: SessionMetrics) => number,
  cursor?: string,
): PaginatedSessions {
  const sorted = [...sessions].sort(sortFn);

  let startIndex = 0;
  if (cursor) {
    const cursorIndex = sorted.findIndex((s) => s.id === cursor);
    if (cursorIndex >= 0) startIndex = cursorIndex + 1;
  }

  const items = sorted.slice(startIndex, startIndex + PAGE_SIZE).map(toExtendedSession);
  const nextCursor = startIndex + PAGE_SIZE < sorted.length ? items[items.length - 1].id : null;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const currentPage = Math.floor(startIndex / PAGE_SIZE) + 1;

  return { items, nextCursor, totalPages, currentPage };
}

export class SessionsService extends Context.Service<SessionsService, SessionsServiceShape>()(
  "radius/SessionsService",
) {
  static readonly layer = Layer.effect(
    SessionsService,
    Effect.gen(function* () {
      const db = yield* Database;
      const sessionSvc = yield* SessionService;

      const list = Effect.fn("listSessions")(function* (params: {
        search?: string;
        sortBy?: string;
        sortDir?: "asc" | "desc";
        cursor?: string;
      }) {
        const sessionRows = db.select().from(session).all();
        const projectRows = db.select().from(project).all();
        const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name]));

        const allMetrics = yield* Effect.all(
          sessionRows.map((sess) =>
            sessionSvc.computeSessionMetrics({
              session: sess,
              projectName: projectNameMap.get(sess.projectId) ?? "Unknown",
            }),
          ),
          { concurrency: 10 },
        );

        let filtered = allMetrics;

        if (params.search) {
          const q = params.search.toLowerCase();
          filtered = allMetrics.filter(
            (s) =>
              (s.title ?? "").toLowerCase().includes(q) ||
              s.projectName.toLowerCase().includes(q) ||
              s.models.some((m) => m.toLowerCase().includes(q)),
          );
        }

        const sortFn = (a: SessionMetrics, b: SessionMetrics): number => {
          let cmp = 0;
          switch (params.sortBy) {
            case "createdAt": cmp = a.createdAt - b.createdAt; break;
            case "duration": cmp = a.duration - b.duration; break;
            case "totalCost": cmp = a.totalCost - b.totalCost; break;
            case "totalTokens": cmp = a.totalTokens - b.totalTokens; break;
            case "messageCount": cmp = a.messageCount - b.messageCount; break;
            case "toolErrorCount": cmp = a.toolErrorCount - b.toolErrorCount; break;
            default: cmp = a.createdAt - b.createdAt;
          }
          return params.sortDir === "asc" ? cmp : -cmp;
        };

        return paginate(filtered, sortFn, params.cursor);
      });

      return SessionsService.of({ list });
    }),
  );
}

import { Effect } from "effect";

import { Database } from "~/db/service";
import { session, project } from "~/db/schema";
import { desc } from "drizzle-orm";
import {
  SessionService,
  type SessionMetrics,
} from "~/features/sessions/services/session";

// ── Shared helpers ──

export function computeMetricsForSessions(
  sessionRows: (typeof session.$inferSelect)[],
  projectNameMap: Map<string, string>,
) {
  return Effect.gen(function*() {
    const svc = yield* SessionService;
    return yield* Effect.all(
      sessionRows.map((sess) =>
        svc.computeSessionMetrics({
          session: sess,
          projectName: projectNameMap.get(sess.projectId) ?? "Unknown",
        }),
      ),
      { concurrency: 10 },
    );
  });
}

export function getProjectNameMap() {
  return Effect.gen(function*() {
    const db = yield* Database;
    const projectRows = db.select().from(project).all();
    return new Map(projectRows.map((p) => [p.id, p.name ?? "Unknown"]));
  });
}

export function getAllSessions() {
  return Effect.gen(function*() {
    const db = yield* Database;
    return db.select().from(session).orderBy(desc(session.createdAt)).all();
  });
}

function toExtendedSession(s: SessionMetrics): {
  id: string;
  projectName: string;
  title: string | null;
  duration: number;
  totalCost: number;
  totalTokens: number;
  models: string[];
  messageCount: number;
  toolCallCount: number;
  toolErrorCount: number;
  createdAt: number;
} {
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

export function paginateExtendedSessions(
  sessions: SessionMetrics[],
  sortFn: (a: SessionMetrics, b: SessionMetrics) => number,
  cursor?: string,
) {
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

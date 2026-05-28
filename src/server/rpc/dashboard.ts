import { createServerFn } from "@tanstack/react-start";
import { Effect, Layer } from "effect";

import { AppRuntime } from "../app-runtime";
import { Database } from "~/db/service";
import { session, project, sessionEvent, event } from "~/db/schema";
import { desc, eq, inArray, and } from "drizzle-orm";
import {
  SessionService,
  SessionError,
  type SessionMetrics,
} from "~/features/sessions/services/session";
import { PlatformLayer } from "../app-layer";

function computeMetricsForSessions(
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

function getProjectNameMap() {
  return Effect.gen(function*() {
    const db = yield* Database;
    const projectRows = db.select().from(project).all();
    return new Map(projectRows.map((p) => [p.id, p.name ?? "Unknown"]));
  });
}

function getAllSessions() {
  return Effect.gen(function*() {
    const db = yield* Database;
    return db.select().from(session).orderBy(desc(session.createdAt)).all();
  });
}

// ── Granular overview endpoints ──

export const getOverviewCards = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(
    Effect.gen(function*() {
      const sessionRows = yield* getAllSessions();
      const projectNameMap = yield* getProjectNameMap();
      const allMetrics = yield* computeMetricsForSessions(sessionRows, projectNameMap);

      const totalCost = allMetrics.reduce((sum, s) => sum + s.totalCost, 0);
      const totalTokens = allMetrics.reduce((sum, s) => sum + s.totalTokens, 0);
      const errorSessionCount = allMetrics.filter((s) => s.toolErrorCount > 0).length;

      const globalModelCounts = new Map<string, number>();
      for (const s of allMetrics) {
        for (const m of s.models) globalModelCounts.set(m, (globalModelCounts.get(m) ?? 0) + 1);
      }
      const mostUsedModelEntry = Array.from(globalModelCounts.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0];

      return {
        totalSessions: allMetrics.length,
        totalCost,
        avgCostPerSession: allMetrics.length > 0 ? totalCost / allMetrics.length : 0,
        totalTokens,
        errorRate: allMetrics.length > 0 ? errorSessionCount / allMetrics.length : 0,
        mostUsedModel: mostUsedModelEntry
          ? { name: mostUsedModelEntry[0], count: mostUsedModelEntry[1] }
          : { name: "—", count: 0 },
      };
    }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
  ),
);

export const getCostOverTime = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(
    Effect.gen(function*() {
      const sessionRows = yield* getAllSessions();
      const projectNameMap = yield* getProjectNameMap();
      const allMetrics = yield* computeMetricsForSessions(sessionRows, projectNameMap);

      const costByDate = new Map<string, { cost: number; sessions: number }>();
      for (const s of allMetrics) {
        const date = new Date(s.createdAt).toISOString().split("T")[0]!;
        const existing = costByDate.get(date) ?? { cost: 0, sessions: 0 };
        existing.cost += s.totalCost;
        existing.sessions += 1;
        costByDate.set(date, existing);
      }

      return Array.from(costByDate.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
  ),
);

export const getModelUsage = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(
    Effect.gen(function*() {
      const sessionRows = yield* getAllSessions();
      const projectNameMap = yield* getProjectNameMap();
      const allMetrics = yield* computeMetricsForSessions(sessionRows, projectNameMap);

      const modelCountMap = new Map<string, { count: number; cost: number }>();
      for (const s of allMetrics) {
        for (const m of s.models) {
          const existing = modelCountMap.get(m) ?? { count: 0, cost: 0 };
          existing.count += 1;
          existing.cost += s.totalCost;
          modelCountMap.set(m, existing);
        }
      }
      return Array.from(modelCountMap.entries())
        .map(([model, data]) => ({ model, ...data }))
        .sort((a, b) => b.count - a.count);
    }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
  ),
);

export const getTopProjects = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(
    Effect.gen(function*() {
      const sessionRows = yield* getAllSessions();
      const projectNameMap = yield* getProjectNameMap();
      const allMetrics = yield* computeMetricsForSessions(sessionRows, projectNameMap);

      const projectSessionsMap = new Map<string, { name: string; sessionCount: number; cost: number }>();
      for (const m of allMetrics) {
        const existing = projectSessionsMap.get(m.projectId) ?? {
          name: m.projectName,
          sessionCount: 0,
          cost: 0,
        };
        existing.sessionCount += 1;
        existing.cost += m.totalCost;
        projectSessionsMap.set(m.projectId, existing);
      }

      return Array.from(projectSessionsMap.values())
        .sort((a, b) => b.sessionCount - a.sessionCount)
        .slice(0, 5);
    }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
  ),
);

export const getThinkingLevels = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(
    Effect.gen(function*() {
      const db = yield* Database;

      const thinkingRows = yield* Effect.try({
        try: () =>
          db.select().from(sessionEvent).where(eq(sessionEvent.eventType, "thinking_change")).all(),
        catch: (cause) =>
          new SessionError({ cause, message: "Failed to get thinking level events" }),
      });

      const thinkingLevelCounts = new Map<string, number>();
      for (const row of thinkingRows) {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(row.data);
        } catch {
          parsed = {};
        }
        const level = (parsed.thinkingLevel ?? parsed.level ?? "off") as string;
        thinkingLevelCounts.set(level, (thinkingLevelCounts.get(level) ?? 0) + 1);
      }
      return Array.from(thinkingLevelCounts.entries())
        .map(([level, count]) => ({ level, count }))
        .sort((a, b) => b.count - a.count);
    }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
  ),
);

export const getStopReasons = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(
    Effect.gen(function*() {
      const sessionRows = yield* getAllSessions();
      const projectNameMap = yield* getProjectNameMap();
      const allMetrics = yield* computeMetricsForSessions(sessionRows, projectNameMap);

      const stopReasonCounts = new Map<string, number>();
      for (const s of allMetrics) {
        for (const [reason, count] of Object.entries(s.stopReasons)) {
          stopReasonCounts.set(reason, (stopReasonCounts.get(reason) ?? 0) + count);
        }
      }
      return Array.from(stopReasonCounts.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);
    }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
  ),
);

export const getDashboardMetrics = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(
    Effect.gen(function*() {
      const db = yield* Database;
      const svc = yield* SessionService;

      const sessionRows = db.select().from(session).orderBy(desc(session.createdAt)).all();
      const projectRows = db.select().from(project).all();
      const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name]));

      const allSessionMetrics = yield* Effect.all(
        sessionRows.map((sess) =>
          svc.computeSessionMetrics({
            session: sess,
            projectName: projectNameMap.get(sess.projectId) ?? "Unknown",
          }),
        ),
        { concurrency: 10 },
      );

      const totalCost = allSessionMetrics.reduce((sum, s) => sum + s.totalCost, 0);
      const totalTokens = allSessionMetrics.reduce((sum, s) => sum + s.totalTokens, 0);

      const projectSessionsMap = new Map<string, SessionMetrics[]>();
      for (const m of allSessionMetrics) {
        const existing = projectSessionsMap.get(m.projectId) ?? [];
        existing.push(m);
        projectSessionsMap.set(m.projectId, existing);
      }

      const projects = Array.from(projectSessionsMap.entries()).map(([projectId, sessions]) => {
        const projectCost = sessions.reduce((sum, s) => sum + s.totalCost, 0);
        const projectMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);
        const projectDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
        const errorSessions = sessions.filter((s) => s.toolErrorCount > 0).length;

        const modelCounts = new Map<string, number>();
        for (const s of sessions) {
          for (const m of s.models) {
            modelCounts.set(m, (modelCounts.get(m) ?? 0) + 1);
          }
        }
        const mostUsedModel =
          Array.from(modelCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

        return {
          id: projectId,
          name: sessions[0]?.projectName ?? "Unknown",
          sessionCount: sessions.length,
          totalCost: projectCost,
          avgMessagesPerSession: sessions.length > 0 ? projectMessages / sessions.length : 0,
          avgDuration: sessions.length > 0 ? projectDuration / sessions.length : 0,
          errorRate: sessions.length > 0 ? errorSessions / sessions.length : 0,
          mostUsedModel,
        };
      });

      const costByDate = new Map<string, { cost: number; sessions: number }>();
      for (const s of allSessionMetrics) {
        const date = new Date(s.createdAt).toISOString().split("T")[0]!;
        const existing = costByDate.get(date) ?? { cost: 0, sessions: 0 };
        existing.cost += s.totalCost;
        existing.sessions += 1;
        costByDate.set(date, existing);
      }

      const costOverTime = Array.from(costByDate.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const modelCountMap = new Map<string, { count: number; cost: number }>();
      for (const s of allSessionMetrics) {
        for (const m of s.models) {
          const existing = modelCountMap.get(m) ?? { count: 0, cost: 0 };
          existing.count += 1;
          existing.cost += s.totalCost;
          modelCountMap.set(m, existing);
        }
      }
      const modelUsage = Array.from(modelCountMap.entries())
        .map(([model, data]) => ({ model, ...data }))
        .sort((a, b) => b.count - a.count);

      const topProjects = projects
        .sort((a, b) => b.sessionCount - a.sessionCount)
        .slice(0, 5)
        .map((p) => ({ name: p.name, sessionCount: p.sessionCount, cost: p.totalCost }));

      // Thinking level distribution
      const thinkingRows = yield* Effect.try({
        try: () =>
          db.select().from(sessionEvent).where(eq(sessionEvent.eventType, "thinking_change")).all(),
        catch: (cause) =>
          new SessionError({ cause, message: "Failed to get thinking level events" }),
      });

      const thinkingLevelCounts = new Map<string, number>();
      for (const row of thinkingRows) {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(row.data);
        } catch {
          parsed = {};
        }
        const level = (parsed.thinkingLevel ?? parsed.level ?? "off") as string;
        thinkingLevelCounts.set(level, (thinkingLevelCounts.get(level) ?? 0) + 1);
      }
      const thinkingLevels = Array.from(thinkingLevelCounts.entries())
        .map(([level, count]) => ({ level, count }))
        .sort((a, b) => b.count - a.count);

      // Stop reasons (aggregated across all sessions)
      const stopReasonCounts = new Map<string, number>();
      for (const s of allSessionMetrics) {
        for (const [reason, count] of Object.entries(s.stopReasons)) {
          stopReasonCounts.set(reason, (stopReasonCounts.get(reason) ?? 0) + count);
        }
      }
      const stopReasons = Array.from(stopReasonCounts.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      // Error rate (sessions with tool errors / total)
      const errorSessionCount = allSessionMetrics.filter((s) => s.toolErrorCount > 0).length;
      const errorRate =
        allSessionMetrics.length > 0 ? errorSessionCount / allSessionMetrics.length : 0;

      // Most used model overall
      const globalModelCounts = new Map<string, number>();
      for (const s of allSessionMetrics) {
        for (const m of s.models) {
          globalModelCounts.set(m, (globalModelCounts.get(m) ?? 0) + 1);
        }
      }
      const mostUsedModelEntry = Array.from(globalModelCounts.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0];
      const mostUsedModel = mostUsedModelEntry
        ? { name: mostUsedModelEntry[0], count: mostUsedModelEntry[1] }
        : { name: "—", count: 0 };

      return {
        totalSessions: allSessionMetrics.length,
        totalCost,
        avgCostPerSession: allSessionMetrics.length > 0 ? totalCost / allSessionMetrics.length : 0,
        totalTokens,
        errorRate,
        mostUsedModel,
        costOverTime,
        modelUsage,
        thinkingLevels,
        stopReasons,
        projects,
        topProjects,
      };
    }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
  ),
);

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

// ── Granular health endpoints ──

export const getHealthSummary = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(
    Effect.gen(function*() {
      const sessionRows = yield* getAllSessions();
      const projectNameMap = yield* getProjectNameMap();
      const allMetrics = yield* computeMetricsForSessions(sessionRows, projectNameMap);

      const totalToolCalls = allMetrics.reduce((s, m) => s + m.toolCallCount, 0);
      const totalToolErrors = allMetrics.reduce((s, m) => s + m.toolErrorCount, 0);
      const errorSessionCount = allMetrics.filter((s) => s.toolErrorCount > 0).length;

      return {
        totalSessions: allMetrics.length,
        totalToolCalls,
        totalToolErrors,
        globalErrorRate: allMetrics.length > 0 ? errorSessionCount / allMetrics.length : 0,
      };
    }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
  ),
);

export const getErrorTrend = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(
    Effect.gen(function*() {
      const sessionRows = yield* getAllSessions();
      const projectNameMap = yield* getProjectNameMap();
      const allMetrics = yield* computeMetricsForSessions(sessionRows, projectNameMap);

      const errorByDate = new Map<string, { total: number; errors: number }>();
      for (const s of allMetrics) {
        const date = new Date(s.createdAt).toISOString().split("T")[0]!;
        const existing = errorByDate.get(date) ?? { total: 0, errors: 0 };
        existing.total++;
        if (s.toolErrorCount > 0) existing.errors++;
        errorByDate.set(date, existing);
      }

      return Array.from(errorByDate.entries())
        .map(([date, data]) => ({
          date,
          totalSessions: data.total,
          errorSessions: data.errors,
          errorRate: data.total > 0 ? data.errors / data.total : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
  ),
);

export const getToolErrors = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(
    Effect.gen(function*() {
      const db = yield* Database;
      const sessionRows = yield* getAllSessions();
      const projectNameMap = yield* getProjectNameMap();
      const allMetrics = yield* computeMetricsForSessions(sessionRows, projectNameMap);

      const sessionIds = allMetrics.map((s) => s.id);
      const eventRows = yield* Effect.try({
        try: () =>
          db
            .select()
            .from(event)
            .where(and(inArray(event.sessionId, sessionIds), eq(event.eventType, "message")))
            .all(),
        catch: (cause) => new SessionError({ cause, message: "Failed to get tool events" }),
      });

      const globalToolCounts = new Map<string, { calls: number; errors: number }>();
      const toolByProject = new Map<string, Map<string, { calls: number; errors: number }>>();
      const sessionProjectMap = new Map<string, string>();
      for (const s of allMetrics) {
        sessionProjectMap.set(s.id, s.projectName);
      }

      for (const row of eventRows) {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(row.data);
        } catch {
          continue;
        }
        if (parsed.role !== "toolResult") continue;
        const name = (parsed.toolName ?? parsed.name ?? "unknown") as string;

        const g = globalToolCounts.get(name) ?? { calls: 0, errors: 0 };
        g.calls++;
        if (parsed.isError) g.errors++;
        globalToolCounts.set(name, g);

        const proj = sessionProjectMap.get(row.sessionId) ?? "Unknown";
        let projMap = toolByProject.get(proj);
        if (!projMap) {
          projMap = new Map();
          toolByProject.set(proj, projMap);
        }
        const p = projMap.get(name) ?? { calls: 0, errors: 0 };
        p.calls++;
        if (parsed.isError) p.errors++;
        projMap.set(name, p);
      }

      const mostFailingTools = Array.from(globalToolCounts.entries())
        .map(([name, data]) => ({
          name,
          callCount: data.calls,
          errorCount: data.errors,
          errorRate: data.calls > 0 ? data.errors / data.calls : 0,
        }))
        .filter((t) => t.errorCount > 0)
        .sort((a, b) => b.errorCount - a.errorCount)
        .slice(0, 10);

      const failingToolsByProject = Array.from(toolByProject.entries())
        .map(([project, tools]) => ({
          project,
          tools: Array.from(tools.entries())
            .map(([name, data]) => ({
              name,
              callCount: data.calls,
              errorCount: data.errors,
              errorRate: data.calls > 0 ? data.errors / data.calls : 0,
            }))
            .filter((t) => t.errorCount > 0)
            .sort((a, b) => b.errorCount - a.errorCount)
            .slice(0, 5),
        }))
        .filter((p) => p.tools.length > 0)
        .sort(
          (a, b) =>
            b.tools.reduce((s, t) => s + t.errorCount, 0) -
            a.tools.reduce((s, t) => s + t.errorCount, 0),
        );

      return { mostFailingTools, failingToolsByProject };
    }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
  ),
);

export const getErrorRateByProject = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(
    Effect.gen(function*() {
      const sessionRows = yield* getAllSessions();
      const projectNameMap = yield* getProjectNameMap();
      const allMetrics = yield* computeMetricsForSessions(sessionRows, projectNameMap);

      const projectSessionMap = new Map<string, typeof allMetrics>();
      for (const m of allMetrics) {
        const existing = projectSessionMap.get(m.projectId) ?? [];
        existing.push(m);
        projectSessionMap.set(m.projectId, existing);
      }

      return Array.from(projectSessionMap.entries())
        .map(([projectId, sessions]) => {
          const errorSessions = sessions.filter((s) => s.toolErrorCount > 0).length;
          return {
            project: projectNameMap.get(projectId) ?? "Unknown",
            errorRate: sessions.length > 0 ? errorSessions / sessions.length : 0,
            sessionCount: sessions.length,
          };
        })
        .sort((a, b) => b.errorRate - a.errorRate);
    }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
  ),
);

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

function paginateExtendedSessions(
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

export const getExpensiveSessions = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { cursor?: string })
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

        return paginateExtendedSessions(
          allMetrics,
          (a, b) => b.totalCost - a.totalCost,
          data.cursor,
        );
      }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
    ),
  );

export const getHighTokenSessions = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { cursor?: string })
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

        return paginateExtendedSessions(
          allMetrics,
          (a, b) => b.totalTokens - a.totalTokens,
          data.cursor,
        );
      }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
    ),
  );

export const getErrorProneSessions = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { cursor?: string })
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

        return paginateExtendedSessions(
          allMetrics,
          (a, b) => b.toolErrorCount - a.toolErrorCount,
          data.cursor,
        );
      }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
    ),
  );

function filterAndSortSessions(
  sessions: SessionMetrics[],
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

  const sortFn = (a: SessionMetrics, b: SessionMetrics): number => {
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

export const getProjectDetail = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { projectId: string })
  .handler(({ data }) =>
    AppRuntime.runPromise(
      Effect.gen(function*() {
        const db = yield* Database;
        const svc = yield* SessionService;

        const projectRows = db.select().from(project).all();
        const projectRow = projectRows.find((p) => p.id === data.projectId);
        if (!projectRow) return null;

        const sessionRows = db
          .select()
          .from(session)
          .where(eq(session.projectId, data.projectId))
          .orderBy(desc(session.createdAt))
          .all();

        const allProjectMetrics = yield* Effect.all(
          sessionRows.map((sess) =>
            svc.computeSessionMetrics({
              session: sess,
              projectName: projectRow.name ?? "Unknown",
            }),
          ),
          { concurrency: 10 },
        );

        const projectCost = allProjectMetrics.reduce((sum, s) => sum + s.totalCost, 0);
        const projectMessages = allProjectMetrics.reduce((sum, s) => sum + s.messageCount, 0);
        const projectDuration = allProjectMetrics.reduce((sum, s) => sum + s.duration, 0);
        const errorSessions = allProjectMetrics.filter((s) => s.toolErrorCount > 0).length;

        const modelCounts = new Map<string, number>();
        for (const s of allProjectMetrics) {
          for (const m of s.models) modelCounts.set(m, (modelCounts.get(m) ?? 0) + 1);
        }

        const modelUsage = Array.from(modelCounts.entries())
          .map(([model, count]) => ({ model, count, cost: 0 }))
          .sort((a, b) => b.count - a.count);

        // Thinking levels for this project from session events
        const sessionIds = sessionRows.map((s) => s.id);
        const thinkingRows = yield* Effect.try({
          try: () =>
            db
              .select()
              .from(sessionEvent)
              .where(
                and(
                  inArray(sessionEvent.sessionId, sessionIds),
                  eq(sessionEvent.eventType, "thinking_change"),
                ),
              )
              .all(),
          catch: (cause) => new SessionError({ cause, message: "Failed to get thinking events" }),
        });

        const thinkingLevelCounts = new Map<string, number>();
        for (const row of thinkingRows) {
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(row.data);
          } catch {
            continue;
          }
          const level = (parsed.thinkingLevel ?? parsed.level ?? "off") as string;
          thinkingLevelCounts.set(level, (thinkingLevelCounts.get(level) ?? 0) + 1);
        }

        const thinkingLevels = Array.from(thinkingLevelCounts.entries())
          .map(([level, count]) => ({ level, count }))
          .sort((a, b) => b.count - a.count);

        return {
          project: {
            id: projectRow.id,
            name: projectRow.name ?? "Unknown",
            sessionCount: allProjectMetrics.length,
            totalCost: projectCost,
            avgMessagesPerSession:
              allProjectMetrics.length > 0 ? projectMessages / allProjectMetrics.length : 0,
            avgDuration:
              allProjectMetrics.length > 0 ? projectDuration / allProjectMetrics.length : 0,
            errorRate: allProjectMetrics.length > 0 ? errorSessions / allProjectMetrics.length : 0,
            mostUsedModel:
              Array.from(modelCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—",
          },
          sessions: allProjectMetrics.map((s) => ({
            id: s.id,
            title: s.title,
            createdAt: s.createdAt,
            duration: s.duration,
            messageCount: s.messageCount,
            totalCost: s.totalCost,
            totalTokens: s.totalTokens,
            models: s.models,
            toolErrorCount: s.toolErrorCount,
          })),
          modelUsage,
          thinkingLevels,
        };
      }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
    ),
  );

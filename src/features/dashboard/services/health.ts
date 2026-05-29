import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import { session, project, event } from "~/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { SessionService, type SessionMetrics } from "~/features/sessions/services/session";

export class HealthError extends Data.TaggedError("HealthError")<{
  readonly cause: unknown;
  readonly message: string;
}> { }

export interface HealthSummary {
  totalSessions: number;
  totalToolCalls: number;
  totalToolErrors: number;
  globalErrorRate: number;
}

export interface ErrorTrendEntry {
  date: string;
  totalSessions: number;
  errorSessions: number;
  errorRate: number;
}

export interface ToolMetrics {
  name: string;
  callCount: number;
  errorCount: number;
  errorRate: number;
}

export interface ErrorRateByProjectEntry {
  project: string;
  errorRate: number;
  sessionCount: number;
}

export interface ExtendedSession {
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
}

export interface PaginatedSessions {
  items: ExtendedSession[];
  nextCursor: string | null;
  totalPages: number;
  currentPage: number;
}

interface HealthServiceShape {
  readonly getSummary: () => Effect.Effect<HealthSummary, HealthError>;
  readonly getErrorTrend: () => Effect.Effect<ErrorTrendEntry[], HealthError>;
  readonly getToolErrors: () => Effect.Effect<
    {
      mostFailingTools: ToolMetrics[];
      failingToolsByProject: { project: string; tools: ToolMetrics[] }[];
    },
    HealthError
  >;
  readonly getErrorRateByProject: () => Effect.Effect<ErrorRateByProjectEntry[], HealthError>;
  readonly getExpensiveSessions: (cursor?: string) => Effect.Effect<PaginatedSessions, HealthError>;
  readonly getHighTokenSessions: (cursor?: string) => Effect.Effect<PaginatedSessions, HealthError>;
  readonly getErrorProneSessions: (
    cursor?: string,
  ) => Effect.Effect<PaginatedSessions, HealthError>;
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

export class HealthService extends Context.Service<HealthService, HealthServiceShape>()(
  "radius/HealthService",
) {
  static readonly layer = Layer.effect(
    HealthService,
    Effect.gen(function*() {
      const db = yield* Database;
      const sessionSvc = yield* SessionService;

      const loadAllMetrics = Effect.fn("loadAllMetrics")(function*() {
        const sessionRows = db.select().from(session).all();
        const projectRows = db.select().from(project).all();
        const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name ?? "Unknown"]));

        return yield* Effect.all(
          sessionRows.map((sess) =>
            sessionSvc.computeSessionMetrics({
              session: sess,
              projectName: projectNameMap.get(sess.projectId) ?? "Unknown",
            }),
          ),
          { concurrency: 10 },
        );
      });

      const getSummary = Effect.fn("getHealthSummary")(function*() {
        const allMetrics = yield* loadAllMetrics();
        const totalToolCalls = allMetrics.reduce((s, m) => s + m.toolCallCount, 0);
        const totalToolErrors = allMetrics.reduce((s, m) => s + m.toolErrorCount, 0);
        const errorSessionCount = allMetrics.filter((s) => s.toolErrorCount > 0).length;

        return {
          totalSessions: allMetrics.length,
          totalToolCalls,
          totalToolErrors,
          globalErrorRate: allMetrics.length > 0 ? errorSessionCount / allMetrics.length : 0,
        };
      });

      const getErrorTrend = Effect.fn("getErrorTrend")(function*() {
        const allMetrics = yield* loadAllMetrics();

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
      });

      const getToolErrors = Effect.fn("getToolErrors")(function*() {
        const allMetrics = yield* loadAllMetrics();
        const sessionIds = allMetrics.map((s) => s.id);

        const eventRows = yield* Effect.try({
          try: () =>
            db
              .select()
              .from(event)
              .where(and(inArray(event.sessionId, sessionIds), eq(event.eventType, "message")))
              .all(),
          catch: (cause) => new HealthError({ cause, message: "Failed to get tool events" }),
        });

        const globalToolCounts = new Map<string, { calls: number; errors: number }>();
        const toolByProject = new Map<string, Map<string, { calls: number; errors: number }>>();
        const sessionProjectMap = new Map(allMetrics.map((s) => [s.id, s.projectName]));

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
      });

      const getErrorRateByProject = Effect.fn("getErrorRateByProject")(function*() {
        const allMetrics = yield* loadAllMetrics();

        const projectSessionMap = new Map<string, typeof allMetrics>();
        for (const m of allMetrics) {
          const existing = projectSessionMap.get(m.projectId) ?? [];
          existing.push(m);
          projectSessionMap.set(m.projectId, existing);
        }

        const projectNameMap = new Map(
          (yield* Effect.try({
            try: () => db.select().from(project).all(),
            catch: (cause) => new HealthError({ cause, message: "Failed to get projects" }),
          })).map((p) => [p.id, p.name]),
        );

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
      });

      const getExpensiveSessions = Effect.fn("getExpensiveSessions")(function*(cursor?: string) {
        const allMetrics = yield* loadAllMetrics();
        return paginate(allMetrics, (a, b) => b.totalCost - a.totalCost, cursor);
      });

      const getHighTokenSessions = Effect.fn("getHighTokenSessions")(function*(cursor?: string) {
        const allMetrics = yield* loadAllMetrics();
        return paginate(allMetrics, (a, b) => b.totalTokens - a.totalTokens, cursor);
      });

      const getErrorProneSessions = Effect.fn("getErrorProneSessions")(function*(cursor?: string) {
        const allMetrics = yield* loadAllMetrics();
        return paginate(allMetrics, (a, b) => b.toolErrorCount - a.toolErrorCount, cursor);
      });

      return HealthService.of({
        getSummary,
        getErrorTrend,
        getToolErrors,
        getErrorRateByProject,
        getExpensiveSessions,
        getHighTokenSessions,
        getErrorProneSessions,
      });
    }),
  );
}

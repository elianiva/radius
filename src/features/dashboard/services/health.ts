import { Context, Data, Effect, Layer } from "effect";

import { Database, type DatabaseShape } from "~/db/service";
import { session, project, event, sessionSummary } from "~/db/schema";
import { eq, inArray, and, sql } from "drizzle-orm";

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

const PAGE_SIZE = 15;

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

export class HealthService extends Context.Service<HealthService, HealthServiceShape>()(
  "radius/HealthService",
) {
  static readonly layer = Layer.effect(
    HealthService,
    Effect.gen(function*() {
      const db = yield* Database;

      const getSummary = Effect.fn("getHealthSummary")(function*() {
        const rows = yield* Effect.try({
          try: () =>
            db
              .select({
                totalSessions: sql<number>`count(*)`,
                totalToolCalls: sql<number>`coalesce(sum(${sessionSummary.toolCallCount}), 0)`,
                totalToolErrors: sql<number>`coalesce(sum(${sessionSummary.toolErrorCount}), 0)`,
                errorSessions: sql<number>`coalesce(sum(case when ${sessionSummary.toolErrorCount} > 0 then 1 else 0 end), 0)`,
              })
              .from(sessionSummary)
              .all(),
          catch: (cause) => new HealthError({ cause, message: "Failed to get health summary" }),
        });

        const row = rows[0]!;
        const totalSessions = row.totalSessions;
        return {
          totalSessions,
          totalToolCalls: row.totalToolCalls,
          totalToolErrors: row.totalToolErrors,
          globalErrorRate: totalSessions > 0 ? row.errorSessions / totalSessions : 0,
        };
      });

      const getErrorTrend = Effect.fn("getErrorTrend")(function*() {
        const rows = yield* Effect.try({
          try: () =>
            db
              .select({
                date: sql<string>`date(${sessionSummary.createdAt} / 1000, 'unixepoch')`,
                totalSessions: sql<number>`count(*)`,
                errorSessions: sql<number>`coalesce(sum(case when ${sessionSummary.toolErrorCount} > 0 then 1 else 0 end), 0)`,
              })
              .from(sessionSummary)
              .groupBy(sql`date(${sessionSummary.createdAt} / 1000, 'unixepoch')`)
              .orderBy(sql`date(${sessionSummary.createdAt} / 1000, 'unixepoch')`)
              .all(),
          catch: (cause) => new HealthError({ cause, message: "Failed to get error trend" }),
        });

        return rows.map((r) => ({
          date: r.date,
          totalSessions: r.totalSessions,
          errorSessions: r.errorSessions,
          errorRate: r.totalSessions > 0 ? r.errorSessions / r.totalSessions : 0,
        }));
      });

      const getToolErrors = Effect.fn("getToolErrors")(function*() {
        // Fetch tool errors by scanning event table — still needed since tool-level isn't in session_summary
        const summaryRows = yield* Effect.try({
          try: () =>
            db
              .select({
                id: sessionSummary.id,
                projectId: sessionSummary.projectId,
              })
              .from(sessionSummary)
              .all(),
          catch: (cause) => new HealthError({ cause, message: "Failed to get session IDs" }),
        });

        const sessionIds = summaryRows.map((r) => r.id);
        const sessionProjectMap = new Map(summaryRows.map((r) => [r.id, r.projectId]));

        const projectRows = yield* Effect.try({
          try: () => db.select({ id: project.id, name: project.name }).from(project).all(),
          catch: (cause) => new HealthError({ cause, message: "Failed to get projects" }),
        });
        const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name ?? "Unknown"]));

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

          const projId = sessionProjectMap.get(row.sessionId) ?? "Unknown";
          const proj = projectNameMap.get(projId) ?? "Unknown";
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
        const projectRows = yield* Effect.try({
          try: () => db.select({ id: project.id, name: project.name }).from(project).all(),
          catch: (cause) => new HealthError({ cause, message: "Failed to get projects" }),
        });
        const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name ?? "Unknown"]));

        const rows = yield* Effect.try({
          try: () =>
            db
              .select({
                projectId: sessionSummary.projectId,
                sessionCount: sql<number>`count(*)`,
                errorSessions: sql<number>`coalesce(sum(case when ${sessionSummary.toolErrorCount} > 0 then 1 else 0 end), 0)`,
              })
              .from(sessionSummary)
              .groupBy(sessionSummary.projectId)
              .all(),
          catch: (cause) => new HealthError({ cause, message: "Failed to get error rate by project" }),
        });

        return rows
          .map((r) => ({
            project: projectNameMap.get(r.projectId) ?? "Unknown",
            errorRate: r.sessionCount > 0 ? r.errorSessions / r.sessionCount : 0,
            sessionCount: r.sessionCount,
          }))
          .sort((a, b) => b.errorRate - a.errorRate);
      });

      function paginatedQuery(
        db: DatabaseShape,
        sortCol: ReturnType<typeof sql>,
        cursor?: string,
        cursorCol?: ReturnType<typeof sql>,
      ) {
        const q = db
          .select({
            id: sessionSummary.id,
            projectId: sessionSummary.projectId,
            createdAt: sessionSummary.createdAt,
            duration: sessionSummary.duration,
            messageCount: sessionSummary.messageCount,
            totalCost: sessionSummary.totalCost,
            totalTokens: sessionSummary.totalTokens,
            models: sessionSummary.models,
            toolCallCount: sessionSummary.toolCallCount,
            toolErrorCount: sessionSummary.toolErrorCount,
            title: session.title,
            projectName: project.name,
          })
          .from(sessionSummary)
          .leftJoin(session, eq(sessionSummary.id, session.id))
          .leftJoin(project, eq(sessionSummary.projectId, project.id))
          .orderBy(sql`${sortCol} desc`)
          .limit(PAGE_SIZE + 1);

        if (cursor && cursorCol) {
          const cursorRow = db
            .select({ val: cursorCol })
            .from(sessionSummary)
            .where(eq(sessionSummary.id, cursor))
            .get();
          if (cursorRow) {
            q.where(sql`${cursorCol} < ${cursorRow.val}
              or (${cursorCol} = ${cursorRow.val} and ${sessionSummary.id} < ${cursor})`);
          }
        }

        return q.all();
      }

      function toPaginated(rows: any[]) {
        const hasMore = rows.length > PAGE_SIZE;
        const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
        const nextCursor = hasMore ? items[items.length - 1].id : null;

        return {
          items: items.map((r: any) => ({
            id: r.id,
            projectName: r.projectName ?? r.projectId,
            title: r.title,
            duration: r.duration,
            totalCost: r.totalCost,
            totalTokens: r.totalTokens,
            models: JSON.parse(r.models) as string[],
            messageCount: r.messageCount,
            toolCallCount: r.toolCallCount,
            toolErrorCount: r.toolErrorCount,
            createdAt: r.createdAt,
          })),
          nextCursor,
          totalPages: 0,
          currentPage: 0,
        };
      }

      const getExpensiveSessions = Effect.fn("getExpensiveSessions")(function*(cursor?: string) {
        const rows = yield* Effect.try({
          try: () =>
            paginatedQuery(db, sql`${sessionSummary.totalCost}`, cursor, sql`${sessionSummary.totalCost}`),
          catch: (cause) => new HealthError({ cause, message: "Failed to get expensive sessions" }),
        });

        return toPaginated(rows);
      });

      const getHighTokenSessions = Effect.fn("getHighTokenSessions")(function*(cursor?: string) {
        const rows = yield* Effect.try({
          try: () =>
            paginatedQuery(db, sql`${sessionSummary.totalTokens}`, cursor, sql`${sessionSummary.totalTokens}`),
          catch: (cause) => new HealthError({ cause, message: "Failed to get high token sessions" }),
        });

        return toPaginated(rows);
      });

      const getErrorProneSessions = Effect.fn("getErrorProneSessions")(function*(cursor?: string) {
        const rows = yield* Effect.try({
          try: () =>
            paginatedQuery(db, sql`${sessionSummary.toolErrorCount}`, cursor, sql`${sessionSummary.toolErrorCount}`),
          catch: (cause) => new HealthError({ cause, message: "Failed to get error prone sessions" }),
        });

        return toPaginated(rows);
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

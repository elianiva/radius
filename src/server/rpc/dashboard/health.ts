import { createServerFn } from "@tanstack/react-start";
import { Effect, Layer } from "effect";

import { AppRuntime } from "../../app-runtime";
import { Database } from "~/db/service";
import { session, project, event } from "~/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import {
  SessionService,
  SessionError,
} from "~/features/sessions/services/session";
import { PlatformLayer } from "../../app-layer";
import { computeMetricsForSessions, getProjectNameMap, getAllSessions, paginateExtendedSessions } from "./shared";

// ── Health endpoints ──

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

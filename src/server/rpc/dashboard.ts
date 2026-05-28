import { createServerFn } from "@tanstack/react-start";
import { Effect, Layer } from "effect";

import { AppRuntime } from "../app-runtime";
import { Database } from "~/db/service";
import { session, project } from "~/db/schema";
import { desc, and, lt } from "drizzle-orm";
import { SessionService, type SessionMetrics } from "~/features/sessions/services/session";
import { PlatformLayer } from "../app-layer";

export const getDashboardMetrics = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(
    Effect.gen(function* () {
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

      return {
        totalSessions: allSessionMetrics.length,
        totalCost,
        avgCostPerSession: allSessionMetrics.length > 0 ? totalCost / allSessionMetrics.length : 0,
        totalTokens,
        costOverTime,
        modelUsage,
        projects,
        topProjects,
      };
    }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
  ),
);

const PAGE_SIZE = 50;

export const getSessionsMetrics = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => v as { cursor?: string })
  .handler(({ data }) =>
    AppRuntime.runPromise(
      Effect.gen(function* () {
        const db = yield* Database;
        const svc = yield* SessionService;

        const conditions = data.cursor ? [lt(session.id, data.cursor)] : [];

        const sessionRows = db
          .select()
          .from(session)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(session.createdAt))
          .limit(PAGE_SIZE + 1)
          .all();

        const hasMore = sessionRows.length > PAGE_SIZE;
        const items = hasMore ? sessionRows.slice(0, PAGE_SIZE) : sessionRows;
        const cursor = hasMore ? items[items.length - 1]!.id : null;

        const projectRows = db.select().from(project).all();
        const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name]));

        const metrics = yield* Effect.all(
          items.map((sess) =>
            svc.computeSessionMetrics({
              session: sess,
              projectName: projectNameMap.get(sess.projectId) ?? "Unknown",
            }),
          ),
          { concurrency: 10 },
        );

        return { items: metrics, cursor };
      }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
    ),
  );

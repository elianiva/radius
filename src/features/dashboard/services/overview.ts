import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import { session, project, sessionEvent } from "~/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  SessionService,
  type SessionMetrics,
} from "~/features/sessions/services/session";

export class OverviewError extends Data.TaggedError("OverviewError")<{
  readonly cause: unknown;
  readonly message: string;
}> {}

export interface OverviewCards {
  totalSessions: number;
  totalCost: number;
  avgCostPerSession: number;
  totalTokens: number;
  errorRate: number;
  mostUsedModel: { name: string; count: number };
}

export interface CostOverTimeEntry {
  date: string;
  cost: number;
  sessions: number;
}

export interface ModelUsageEntry {
  model: string;
  count: number;
  cost: number;
}

export interface TopProjectEntry {
  name: string;
  sessionCount: number;
  cost: number;
}

export interface ThinkingLevelEntry {
  level: string;
  count: number;
}

export interface StopReasonEntry {
  reason: string;
  count: number;
}

export interface ProjectMetrics {
  id: string;
  name: string;
  sessionCount: number;
  totalCost: number;
  avgMessagesPerSession: number;
  avgDuration: number;
  errorRate: number;
  mostUsedModel: string;
}

export interface DashboardMetrics {
  totalSessions: number;
  totalCost: number;
  avgCostPerSession: number;
  totalTokens: number;
  errorRate: number;
  mostUsedModel: { name: string; count: number };
  costOverTime: CostOverTimeEntry[];
  modelUsage: ModelUsageEntry[];
  thinkingLevels: ThinkingLevelEntry[];
  stopReasons: StopReasonEntry[];
  projects: ProjectMetrics[];
  topProjects: TopProjectEntry[];
}

interface OverviewServiceShape {
  readonly getCards: () => Effect.Effect<OverviewCards, OverviewError>;
  readonly getCostOverTime: () => Effect.Effect<CostOverTimeEntry[], OverviewError>;
  readonly getModelUsage: () => Effect.Effect<ModelUsageEntry[], OverviewError>;
  readonly getTopProjects: () => Effect.Effect<TopProjectEntry[], OverviewError>;
  readonly getThinkingLevels: () => Effect.Effect<ThinkingLevelEntry[], OverviewError>;
  readonly getStopReasons: () => Effect.Effect<StopReasonEntry[], OverviewError>;
  readonly getDashboardMetrics: () => Effect.Effect<DashboardMetrics, OverviewError>;
}

export class OverviewService extends Context.Service<OverviewService, OverviewServiceShape>()(
  "radius/OverviewService",
) {
  static readonly layer = Layer.effect(
    OverviewService,
    Effect.gen(function* () {
      const db = yield* Database;
      const sessionSvc = yield* SessionService;

      const getAllSessionMetrics = Effect.fn("getAllSessionMetrics")(function* () {
        const sessionRows = db.select().from(session).orderBy(desc(session.createdAt)).all();
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

      const getCards = Effect.fn("getOverviewCards")(function* () {
        const allMetrics = yield* getAllSessionMetrics();

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
      });

      const getCostOverTime = Effect.fn("getCostOverTime")(function* () {
        const allMetrics = yield* getAllSessionMetrics();

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
      });

      const getModelUsage = Effect.fn("getModelUsage")(function* () {
        const allMetrics = yield* getAllSessionMetrics();

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
      });

      const getTopProjects = Effect.fn("getTopProjects")(function* () {
        const allMetrics = yield* getAllSessionMetrics();

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
      });

      const getThinkingLevels = Effect.fn("getThinkingLevels")(function* () {
        const thinkingRows = yield* Effect.try({
          try: () =>
            db.select().from(sessionEvent).where(eq(sessionEvent.eventType, "thinking_change")).all(),
          catch: (cause) =>
            new OverviewError({ cause, message: "Failed to get thinking level events" }),
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
      });

      const getStopReasons = Effect.fn("getStopReasons")(function* () {
        const allMetrics = yield* getAllSessionMetrics();

        const stopReasonCounts = new Map<string, number>();
        for (const s of allMetrics) {
          for (const [reason, count] of Object.entries(s.stopReasons)) {
            stopReasonCounts.set(reason, (stopReasonCounts.get(reason) ?? 0) + count);
          }
        }
        return Array.from(stopReasonCounts.entries())
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count);
      });

      const getDashboardMetrics = Effect.fn("getDashboardMetrics")(function* () {
        const allSessionMetrics = yield* getAllSessionMetrics();

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

        const thinkingRows = yield* Effect.try({
          try: () =>
            db.select().from(sessionEvent).where(eq(sessionEvent.eventType, "thinking_change")).all(),
          catch: (cause) =>
            new OverviewError({ cause, message: "Failed to get thinking level events" }),
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

        const stopReasonCounts = new Map<string, number>();
        for (const s of allSessionMetrics) {
          for (const [reason, count] of Object.entries(s.stopReasons)) {
            stopReasonCounts.set(reason, (stopReasonCounts.get(reason) ?? 0) + count);
          }
        }
        const stopReasons = Array.from(stopReasonCounts.entries())
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count);

        const errorSessionCount = allSessionMetrics.filter((s) => s.toolErrorCount > 0).length;
        const errorRate =
          allSessionMetrics.length > 0 ? errorSessionCount / allSessionMetrics.length : 0;

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
      });

      return OverviewService.of({
        getCards,
        getCostOverTime,
        getModelUsage,
        getTopProjects,
        getThinkingLevels,
        getStopReasons,
        getDashboardMetrics,
      });
    }),
  );
}

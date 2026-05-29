import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import { sessionEvent, sessionSummary } from "~/db/schema";
import { eq, inArray, and, sql } from "drizzle-orm";

export class ProjectError extends Data.TaggedError("ProjectError")<{
  readonly cause: unknown;
  readonly message: string;
}> { }

export interface ProjectDetailData {
  project: {
    id: string;
    name: string;
    sessionCount: number;
    totalCost: number;
    avgMessagesPerSession: number;
    avgDuration: number;
    errorRate: number;
    mostUsedModel: string;
  };
  sessions: {
    id: string;
    title: string | null;
    createdAt: number;
    duration: number;
    messageCount: number;
    totalCost: number;
    totalTokens: number;
    models: string[];
    toolErrorCount: number;
  }[];
  modelUsage: { model: string; count: number; cost: number }[];
  thinkingLevels: { level: string; count: number }[];
}

interface ProjectServiceShape {
  readonly getDetail: (projectId: string) => Effect.Effect<ProjectDetailData | null, ProjectError>;
}

export class ProjectService extends Context.Service<ProjectService, ProjectServiceShape>()(
  "radius/ProjectService",
) {
  static readonly layer = Layer.effect(
    ProjectService,
    Effect.gen(function*() {
      const db = yield* Database;

      const getDetail = Effect.fn("getProjectDetail")(function*(projectId: string) {
        // Check if project has any sessions
        const countRow = yield* Effect.try({
          try: () =>
            db
              .select({ count: sql<number>`count(*)` })
              .from(sessionSummary)
              .where(eq(sessionSummary.projectId, projectId))
              .all(),
          catch: (cause) => new ProjectError({ cause, message: "Failed to check project" }),
        });
        if (countRow[0]!.count === 0) return null;

        // Aggregate project-level metrics
        const metricRows = yield* Effect.try({
          try: () =>
            db
              .select({
                totalCost: sql<number>`coalesce(sum(${sessionSummary.totalCost}), 0)`,
                totalMessages: sql<number>`coalesce(sum(${sessionSummary.messageCount}), 0)`,
                totalDuration: sql<number>`coalesce(sum(${sessionSummary.duration}), 0)`,
                errorSessions: sql<number>`coalesce(sum(case when ${sessionSummary.toolErrorCount} > 0 then 1 else 0 end), 0)`,
                sessionCount: sql<number>`count(*)`,
              })
              .from(sessionSummary)
              .where(eq(sessionSummary.projectId, projectId))
              .all(),
          catch: (cause) => new ProjectError({ cause, message: "Failed to get project metrics" }),
        });
        const agg = metricRows[0]!;

        // Get per-session summaries
        const sessionRows = yield* Effect.try({
          try: () =>
            db
              .select()
              .from(sessionSummary)
              .where(eq(sessionSummary.projectId, projectId))
              .orderBy(sql`${sessionSummary.createdAt} desc`)
              .all(),
          catch: (cause) => new ProjectError({ cause, message: "Failed to get project sessions" }),
        });

        // Compute model usage and most-used model from stored JSON
        const modelCounts = new Map<string, number>();
        for (const s of sessionRows) {
          const models = JSON.parse(s.models) as string[];
          for (const m of models) {
            modelCounts.set(m, (modelCounts.get(m) ?? 0) + 1);
          }
        }

        const modelUsage = Array.from(modelCounts.entries())
          .map(([model, count]) => ({ model, count, cost: 0 }))
          .sort((a, b) => b.count - a.count);

        // Thinking levels still from sessionEvent table
        const sessionIds = sessionRows.map((s) => s.id);
        let thinkingLevels: { level: string; count: number }[] = [];

        if (sessionIds.length > 0) {
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
            catch: (cause) =>
              new ProjectError({ cause, message: "Failed to get thinking events" }),
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

          thinkingLevels = Array.from(thinkingLevelCounts.entries())
            .map(([level, count]) => ({ level, count }))
            .sort((a, b) => b.count - a.count);
        }

        return {
          project: {
            id: projectId,
            name: sessionRows[0]?.projectId ?? projectId,
            sessionCount: agg.sessionCount,
            totalCost: agg.totalCost,
            avgMessagesPerSession:
              agg.sessionCount > 0 ? agg.totalMessages / agg.sessionCount : 0,
            avgDuration: agg.sessionCount > 0 ? agg.totalDuration / agg.sessionCount : 0,
            errorRate: agg.sessionCount > 0 ? agg.errorSessions / agg.sessionCount : 0,
            mostUsedModel: modelUsage[0]?.model ?? "—",
          },
          sessions: sessionRows.map((s) => ({
            id: s.id,
            title: null, // session_summary doesn't store title, could join if needed
            createdAt: s.createdAt,
            duration: s.duration,
            messageCount: s.messageCount,
            totalCost: s.totalCost,
            totalTokens: s.totalTokens,
            models: JSON.parse(s.models) as string[],
            toolErrorCount: s.toolErrorCount,
          })),
          modelUsage,
          thinkingLevels,
        };
      });

      return ProjectService.of({ getDetail });
    }),
  );
}

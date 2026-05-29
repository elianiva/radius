import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import { sessionSummary, swearEntry, session, event } from "~/db/schema";
import { project } from "~/db/schema";
import { sql, eq, inArray } from "drizzle-orm";

export class WrappedError extends Data.TaggedError("WrappedError")<{
  readonly cause: unknown;
  readonly message: string;
}> {}

export interface WrappedData {
  yearOptions: number[];
  totalStats: {
    totalSessions: number;
    totalCost: number;
    totalTokens: number;
    totalToolCalls: number;
    totalToolErrors: number;
    totalSwears: number;
    topSwear: { word: string; count: number } | null;
    totalDuration: number;
  };
  busiestDay: { date: string; count: number } | null;
  mostUsedModel: { name: string; count: number } | null;
  modelJourney: { month: string; model: string; count: number }[];
  mostExpensiveSession: ExtendedSession | null;
  longestSession: ExtendedSession | null;
  peakTool: { name: string; calls: number } | null;
  projectBreakdown: { name: string; sessionCount: number; cost: number }[];
  thinkingLevels: { level: string; count: number }[];
  worstErrorDay: { date: string; errorCount: number } | null;
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

interface WrappedServiceShape {
  readonly getAll: (year?: number) => Effect.Effect<WrappedData, WrappedError>;
}

export class WrappedService extends Context.Service<WrappedService, WrappedServiceShape>()(
  "radius/WrappedService",
) {
  static readonly layer = Layer.effect(
    WrappedService,
    Effect.gen(function*() {
      const db = yield* Database;

      const yearFilter = (year?: number) =>
        year ? sql`strftime('%Y', ${sessionSummary.createdAt} / 1000, 'unixepoch') = ${String(year)}` : undefined;

      const getAll = Effect.fn("getWrappedData")(function*(year?: number) {
        const filter = yearFilter(year);

        // Year options
        const yearRows = yield* Effect.try({
          try: () =>
            db
              .select({
                year: sql<string>`strftime('%Y', ${sessionSummary.createdAt} / 1000, 'unixepoch')`,
              })
              .from(sessionSummary)
              .groupBy(sql`strftime('%Y', ${sessionSummary.createdAt} / 1000, 'unixepoch')`)
              .orderBy(sql`strftime('%Y', ${sessionSummary.createdAt} / 1000, 'unixepoch') desc`)
              .all(),
          catch: (cause) => new WrappedError({ cause, message: "Failed to get years" }),
        });
        const yearOptions = yearRows.map((r) => Number.parseInt(r.year));

        // Total stats
        const statsRows = yield* Effect.try({
          try: () => {
            const q = db
              .select({
                totalSessions: sql<number>`count(*)`,
                totalCost: sql<number>`coalesce(sum(${sessionSummary.totalCost}), 0)`,
                totalTokens: sql<number>`coalesce(sum(${sessionSummary.totalTokens}), 0)`,
                totalToolCalls: sql<number>`coalesce(sum(${sessionSummary.toolCallCount}), 0)`,
                totalToolErrors: sql<number>`coalesce(sum(${sessionSummary.toolErrorCount}), 0)`,
                totalDuration: sql<number>`coalesce(sum(${sessionSummary.duration}), 0)`,
              })
              .from(sessionSummary);
            if (filter) q.where(filter);
            return q.all();
          },
          catch: (cause) => new WrappedError({ cause, message: "Failed to get stats" }),
        });
        const stats = statsRows[0]!;

        // Swear stats
        const swearRows = yield* Effect.try({
          try: () => {
            const q = db
              .select({
                totalSwears: sql<number>`count(*)`,
                topWord: swearEntry.word,
                topCount: sql<number>`count(*)`,
              })
              .from(swearEntry);
            if (filter) q.where(sql`strftime('%Y', ${swearEntry.createdAt} / 1000, 'unixepoch') = ${String(year)}`);
            return q.groupBy(swearEntry.word).orderBy(sql`count(*) desc`).limit(1).all();
          },
          catch: (cause) => new WrappedError({ cause, message: "Failed to get swear stats" }),
        });
        const totalSwears = swearRows.reduce((sum, r) => sum + r.totalSwears, 0);
        const topSwear = swearRows.length > 0 ? { word: swearRows[0]!.topWord, count: swearRows[0]!.topCount } : null;

        // Busiest day
        const busyRows = yield* Effect.try({
          try: () => {
            const q = db
              .select({
                date: sql<string>`date(${sessionSummary.createdAt} / 1000, 'unixepoch')`,
                count: sql<number>`count(*)`,
              })
              .from(sessionSummary);
            if (filter) q.where(filter);
            return q
              .groupBy(sql`date(${sessionSummary.createdAt} / 1000, 'unixepoch')`)
              .orderBy(sql`count(*) desc`)
              .limit(1)
              .all();
          },
          catch: (cause) => new WrappedError({ cause, message: "Failed to get busiest day" }),
        });
        const busiestDay = busyRows[0] ? { date: busyRows[0].date, count: busyRows[0].count } : null;

        // Most used model
        const modelRows = yield* Effect.try({
          try: () => {
            const q = db.select({ models: sessionSummary.models }).from(sessionSummary);
            if (filter) q.where(filter);
            return q.all();
          },
          catch: (cause) => new WrappedError({ cause, message: "Failed to get model data" }),
        });
        const modelCounts = new Map<string, number>();
        for (const r of modelRows) {
          const models = JSON.parse(r.models) as string[];
          for (const m of models) {
            modelCounts.set(m, (modelCounts.get(m) ?? 0) + 1);
          }
        }
        const mostUsedModelEntry = Array.from(modelCounts.entries()).sort((a, b) => b[1] - a[1])[0];
        const mostUsedModel = mostUsedModelEntry
          ? { name: mostUsedModelEntry[0], count: mostUsedModelEntry[1] }
          : null;

        // Model journey (monthly breakdown)
        const modelJourneyRows = yield* Effect.try({
          try: () => {
            const q = db
              .select({
                month: sql<string>`strftime('%Y-%m', ${sessionSummary.createdAt} / 1000, 'unixepoch')`,
                models: sessionSummary.models,
              })
              .from(sessionSummary);
            if (filter) q.where(filter);
            return q.orderBy(sql`strftime('%Y-%m', ${sessionSummary.createdAt} / 1000, 'unixepoch')`).all();
          },
          catch: (cause) => new WrappedError({ cause, message: "Failed to get model journey" }),
        });
        const monthModelCounts = new Map<string, Map<string, number>>();
        for (const r of modelJourneyRows) {
          let monthMap = monthModelCounts.get(r.month);
          if (!monthMap) {
            monthMap = new Map();
            monthModelCounts.set(r.month, monthMap);
          }
          const models = JSON.parse(r.models) as string[];
          for (const m of models) {
            monthMap.set(m, (monthMap.get(m) ?? 0) + 1);
          }
        }
        const modelJourney = Array.from(monthModelCounts.entries()).flatMap(([month, models]) =>
          Array.from(models.entries()).map(([model, count]) => ({ month, model, count })),
        );

        // Project breakdown
        const projectRows = yield* Effect.try({
          try: () => db.select({ id: project.id, name: project.name }).from(project).all(),
          catch: (cause) => new WrappedError({ cause, message: "Failed to get projects" }),
        });
        const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name ?? "Unknown"]));

        const projBreakRows = yield* Effect.try({
          try: () => {
            const q = db
              .select({
                projectId: sessionSummary.projectId,
                sessionCount: sql<number>`count(*)`,
                cost: sql<number>`coalesce(sum(${sessionSummary.totalCost}), 0)`,
              })
              .from(sessionSummary);
            if (filter) q.where(filter);
            return q
              .groupBy(sessionSummary.projectId)
              .orderBy(sql`count(*) desc`)
              .all();
          },
          catch: (cause) => new WrappedError({ cause, message: "Failed to get project breakdown" }),
        });
        const projectBreakdown = projBreakRows.map((r) => ({
          name: projectNameMap.get(r.projectId) ?? "Unknown",
          sessionCount: r.sessionCount,
          cost: r.cost,
        }));

        // Most expensive & longest session
        const sessionRows = yield* Effect.try({
          try: () => {
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
              })
              .from(sessionSummary)
              .leftJoin(session, eq(sessionSummary.id, session.id));
            if (filter) q.where(filter);
            return q.all();
          },
          catch: (cause) => new WrappedError({ cause, message: "Failed to get sessions" }),
        });

        const toExtended = (r: (typeof sessionRows)[number]) => ({
          id: r.id,
          projectName: projectNameMap.get(r.projectId) ?? "Unknown",
          title: r.title,
          duration: r.duration,
          totalCost: r.totalCost,
          totalTokens: r.totalTokens,
          models: JSON.parse(r.models) as string[],
          messageCount: r.messageCount,
          toolCallCount: r.toolCallCount,
          toolErrorCount: r.toolErrorCount,
          createdAt: r.createdAt,
        });

        const byCost = [...sessionRows].sort((a, b) => b.totalCost - a.totalCost);
        const byDuration = [...sessionRows].sort((a, b) => b.duration - a.duration);
        const mostExpensiveSession = byCost[0] ? toExtended(byCost[0]) : null;
        const longestSession = byDuration[0] ? toExtended(byDuration[0]) : null;

        // Peak tool from event table
        const sessionIds = sessionRows.map((r) => r.id);
        const toolRows = yield* Effect.try({
          try: () => {
            const q = db
              .select({ data: event.data })
              .from(event)
              .where(
                inArray(event.sessionId, sessionIds).append(sql`and ${event.eventType} = 'message'`),
              );
            return q.all();
          },
          catch: (cause) => new WrappedError({ cause, message: "Failed to get tool data" }),
        });

        const toolCalls = new Map<string, number>();
        for (const r of toolRows) {
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(r.data);
          } catch {
            continue;
          }
          const content = parsed.content;
          if (Array.isArray(content)) {
            for (const part of content) {
              if (typeof part === "object" && part !== null && (part as any).type === "toolCall") {
                const name = (part as any).name ?? "unknown";
                toolCalls.set(name, (toolCalls.get(name) ?? 0) + 1);
              }
            }
          }
        }
        const peakToolEntry = Array.from(toolCalls.entries()).sort((a, b) => b[1] - a[1])[0];
        const peakTool = peakToolEntry ? { name: peakToolEntry[0], calls: peakToolEntry[1] } : null;

        // Thinking levels
        const thinkingRows = yield* Effect.try({
          try: () => {
            const q = db
              .select({
                level: sql<string>`json_extract(data, '$.thinkingLevel')`,
                count: sql<number>`count(*)`,
              })
              .from(event)
              .where(sql`event_type = 'thinking_level_change'`);
            return q.groupBy(sql`json_extract(data, '$.thinkingLevel')`)
              .orderBy(sql`count(*) desc`)
              .all();
          },
          catch: (cause) => new WrappedError({ cause, message: "Failed to get thinking levels" }),
        });
        const thinkingLevels = thinkingRows.map((r) => ({
          level: r.level ?? "off",
          count: r.count,
        }));

        // Worst error day
        const errorDayRows = yield* Effect.try({
          try: () => {
            const q = db
              .select({
                date: sql<string>`date(${sessionSummary.createdAt} / 1000, 'unixepoch')`,
                errorCount: sql<number>`coalesce(sum(${sessionSummary.toolErrorCount}), 0)`,
              })
              .from(sessionSummary);
            if (filter) q.where(filter);
            return q
              .groupBy(sql`date(${sessionSummary.createdAt} / 1000, 'unixepoch')`)
              .orderBy(sql`coalesce(sum(${sessionSummary.toolErrorCount}), 0) desc`)
              .limit(1)
              .all();
          },
          catch: (cause) => new WrappedError({ cause, message: "Failed to get error day" }),
        });
        const worstErrorDay = errorDayRows[0] && errorDayRows[0].errorCount > 0
          ? { date: errorDayRows[0].date, errorCount: errorDayRows[0].errorCount }
          : null;

        return {
          yearOptions,
          totalStats: {
            totalSessions: stats.totalSessions,
            totalCost: stats.totalCost,
            totalTokens: stats.totalTokens,
            totalToolCalls: stats.totalToolCalls,
            totalToolErrors: stats.totalToolErrors,
            totalSwears,
            topSwear,
            totalDuration: stats.totalDuration,
          },
          busiestDay,
          mostUsedModel,
          modelJourney,
          mostExpensiveSession,
          longestSession,
          peakTool,
          projectBreakdown,
          thinkingLevels,
          worstErrorDay,
        };
      });

      return WrappedService.of({ getAll });
    }),
  );
}

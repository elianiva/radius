import { createServerFn } from "@tanstack/react-start";
import { Effect, Layer } from "effect";

import { AppRuntime } from "../../app-runtime";
import { Database } from "~/db/service";
import { session, project, sessionEvent } from "~/db/schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import {
  SessionService,
  SessionError,
} from "~/features/sessions/services/session";
import { PlatformLayer } from "../../app-layer";

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

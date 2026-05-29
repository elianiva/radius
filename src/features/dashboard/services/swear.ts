import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import { swearEntry } from "~/db/schema";
import { sql } from "drizzle-orm";
import type { SwearMention, SwearSummary } from "./swear-types";

export interface SwearEntryData {
  sessionId: string;
  projectName: string;
  sessionTitle: string | null;
  word: string;
  context: string;
  createdAt: number;
}

export class SwearError extends Data.TaggedError("SwearError")<{
  readonly cause: unknown;
  readonly message: string;
}> {}

interface SwearServiceShape {
  readonly getSummary: () => Effect.Effect<SwearSummary, SwearError>;
}

export class SwearService extends Context.Service<SwearService, SwearServiceShape>()(
  "radius/SwearService",
) {
  static readonly layer = Layer.effect(
    SwearService,
    Effect.gen(function*() {
      const db = yield* Database;

      const getSummary = Effect.fn("getSwearMetrics")(function*() {
        const countRows = yield* Effect.try({
          try: () =>
            db
              .select({
                totalMentions: sql<number>`count(*)`,
                uniqueSessions: sql<number>`count(distinct ${swearEntry.sessionId})`,
                uniqueProjects: sql<number>`count(distinct ${swearEntry.projectName})`,
              })
              .from(swearEntry)
              .all(),
          catch: (cause) => new SwearError({ cause, message: "Failed to count swear entries" }),
        });
        const counts = countRows[0]!;

        const allWordRows = yield* Effect.try({
          try: () =>
            db
              .select({
                word: swearEntry.word,
                count: sql<number>`count(*)`,
              })
              .from(swearEntry)
              .groupBy(swearEntry.word)
              .orderBy(sql`count(*) desc`)
              .all(),
          catch: (cause) => new SwearError({ cause, message: "Failed to get all swear word frequencies" }),
        });
        const allWordFrequencies = allWordRows.map((r) => ({ word: r.word, count: r.count }));

        const wordRows = yield* Effect.try({
          try: () =>
            db
              .select({
                word: swearEntry.word,
                count: sql<number>`count(*)`,
              })
              .from(swearEntry)
              .groupBy(swearEntry.word)
              .orderBy(sql`count(*) desc`)
              .limit(10)
              .all(),
          catch: (cause) => new SwearError({ cause, message: "Failed to get top swear words" }),
        });
        const topWords = wordRows.map((r) => ({ word: r.word, count: r.count }));

        const trendRows = yield* Effect.try({
          try: () =>
            db
              .select({
                date: sql<string>`date(${swearEntry.createdAt} / 1000, 'unixepoch')`,
                count: sql<number>`count(*)`,
              })
              .from(swearEntry)
              .groupBy(sql`date(${swearEntry.createdAt} / 1000, 'unixepoch')`)
              .orderBy(sql`date(${swearEntry.createdAt} / 1000, 'unixepoch')`)
              .all(),
          catch: (cause) => new SwearError({ cause, message: "Failed to get swear trend" }),
        });
        const swearTrend = trendRows.map((r) => ({ date: r.date, count: r.count }));

        const projectRows = yield* Effect.try({
          try: () =>
            db
              .select({
                project: swearEntry.projectName,
                count: sql<number>`count(*)`,
                sessions: sql<number>`count(distinct ${swearEntry.sessionId})`,
              })
              .from(swearEntry)
              .groupBy(swearEntry.projectName)
              .orderBy(sql`count(*) desc`)
              .all(),
          catch: (cause) => new SwearError({ cause, message: "Failed to get swear by project" }),
        });
        const swearByProject = projectRows.map((r) => ({
          project: r.project,
          count: r.count,
          sessions: r.sessions,
        }));

        const sessionRows = yield* Effect.try({
          try: () =>
            db
              .select({
                sessionId: swearEntry.sessionId,
                mentionCount: sql<number>`count(*)`,
              })
              .from(swearEntry)
              .groupBy(swearEntry.sessionId)
              .orderBy(sql`count(*) desc`)
              .limit(10)
              .all(),
          catch: (cause) => new SwearError({ cause, message: "Failed to get top swear sessions" }),
        });

        const topSessionIds = sessionRows.map((r) => r.sessionId);
        let topSessions: SwearMention[] = [];

        if (topSessionIds.length > 0) {
          const mentionRows = yield* Effect.try({
            try: () =>
              db
                .select()
                .from(swearEntry)
                .all(),
            catch: (cause) => new SwearError({ cause, message: "Failed to get swear entries" }),
          });

          const sessionMap = new Map<string, typeof mentionRows>();
          for (const r of mentionRows) {
            const existing = sessionMap.get(r.sessionId) ?? [];
            existing.push(r);
            sessionMap.set(r.sessionId, existing);
          }

          topSessions = topSessionIds
            .map((sid) => {
              const entries = sessionMap.get(sid) ?? [];
              const first = entries[0];
              return {
                word: first?.word ?? "",
                context: first?.context ?? "",
                projectName: first?.projectName ?? "",
                sessionTitle: first?.sessionTitle ?? null,
                sessionId: sid,
                createdAt: first?.createdAt ?? 0,
              };
            })
            .filter((s): s is SwearMention => s.word !== "");
        }

        return {
          totalMentions: counts.totalMentions,
          totalSessions: counts.uniqueSessions,
          uniqueProjects: counts.uniqueProjects,
          topWords,
          topSessions,
          swearTrend,
          swearByProject,
          allWordFrequencies,
        };
      });

      return SwearService.of({ getSummary });
    }),
  );
}

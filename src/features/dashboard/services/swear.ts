import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import { session, project } from "~/db/schema";
import { SessionService } from "~/features/sessions/services/session";

import { SWEAR_WORDS } from "./swear-types";
import type { SwearWord, SwearMention, SwearSummary } from "./swear-types";

export class SwearError extends Data.TaggedError("SwearError")<{
  readonly cause: unknown;
  readonly message: string;
}> { }

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
      const sessionSvc = yield* SessionService;

      const getSummary = Effect.fn("getSwearMetrics")(function*() {
        const sessionRows = db.select().from(session).all();
        const projectRows = db.select().from(project).all();
        const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name]));

        const allSessionMetrics = yield* Effect.all(
          sessionRows.map((sess) =>
            sessionSvc.computeSessionMetrics({
              session: sess,
              projectName: projectNameMap.get(sess.projectId) ?? "Unknown",
            }),
          ),
          { concurrency: 10 },
        );

        const allMentions: SwearMention[] = [];

        for (const sm of allSessionMetrics) {
          const events = yield* sessionSvc.getEvents({ sessionId: sm.id });
          const userMessages = events.filter((e) => {
            if (e.eventType !== "message") return false;
            try {
              const parsed = JSON.parse(e.data) as Record<string, unknown>;
              return parsed.role === "user";
            } catch {
              return false;
            }
          });

          for (const msg of userMessages) {
            try {
              const parsed = JSON.parse(msg.data) as Record<string, unknown>;
              const content = (parsed.content ?? parsed.text ?? "") as string;
              const matches = findSwearWords(content);

              for (const match of matches) {
                allMentions.push({
                  word: match.word,
                  context: extractContext(content, match.index, match.word.length),
                  projectName: sm.projectName,
                  sessionTitle: sm.title,
                  sessionId: sm.id,
                  createdAt: sm.createdAt,
                });
              }
            } catch {
              continue;
            }
          }

          if (allSessionMetrics.indexOf(sm) % 10 === 9) {
            yield* Effect.yieldNow();
          }
        }

        const wordCounts = new Map<string, number>();
        for (const m of allMentions) {
          wordCounts.set(m.word, (wordCounts.get(m.word) ?? 0) + 1);
        }
        const topWords = Array.from(wordCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([word, count]) => ({ word, count }));

        const projectMap = new Map<string, { count: number; sessions: Set<string> }>();
        for (const m of allMentions) {
          let entry = projectMap.get(m.projectName);
          if (!entry) {
            entry = { count: 0, sessions: new Set() };
            projectMap.set(m.projectName, entry);
          }
          entry.count++;
          entry.sessions.add(m.sessionId);
        }
        const swearByProject = Array.from(projectMap.entries())
          .map(([project, data]) => ({ project, count: data.count, sessions: data.sessions.size }))
          .sort((a, b) => b.count - a.count);

        const dateMap = new Map<string, number>();
        for (const m of allMentions) {
          const date = new Date(m.createdAt).toISOString().split("T")[0]!;
          dateMap.set(date, (dateMap.get(date) ?? 0) + 1);
        }
        const swearTrend = Array.from(dateMap.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const sessionSwearMap = new Map<string, SwearMention[]>();
        for (const m of allMentions) {
          const existing = sessionSwearMap.get(m.sessionId) ?? [];
          existing.push(m);
          sessionSwearMap.set(m.sessionId, existing);
        }
        const topSessions = Array.from(sessionSwearMap.entries())
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 10)
          .map(([, mentions]) => mentions[0]!);

        const uniqueSessions = new Set(allMentions.map((m) => m.sessionId));
        const uniqueProjects = new Set(allMentions.map((m) => m.projectName));

        return {
          totalMentions: allMentions.length,
          totalSessions: uniqueSessions.size,
          uniqueProjects: uniqueProjects.size,
          topWords,
          topSessions,
          swearTrend,
          swearByProject,
        };
      });

      return SwearService.of({ getSummary });
    }),
  );
}

function findSwearWords(text: string): { word: SwearWord; index: number }[] {
  const lower = text.toLowerCase();
  const results: { word: SwearWord; index: number }[] = [];
  for (const word of SWEAR_WORDS) {
    let startIndex = 0;
    while (true) {
      const idx = lower.indexOf(word, startIndex);
      if (idx === -1) break;
      results.push({ word, index: idx });
      startIndex = idx + word.length;
    }
  }
  return results.sort((a, b) => a.index - b.index);
}

function extractContext(text: string, index: number, wordLength: number, radius = 40): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + wordLength + radius);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";
  return snippet;
}

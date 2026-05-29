import { Effect } from "effect";
import {
  SWEAR_WORDS,
  type SwearMention,
  type SwearSummary,
  type SwearWord,
} from "~/features/dashboard/swear-words";
import type { SessionMetrics, TimelineEvent } from "~/features/sessions/services/session";

function findSwearWords(text: string): { word: SwearWord; index: number }[] {
  const lower = text.toLowerCase();
  const results: { word: SwearWord; index: number }[] = [];
  for (const word of SWEAR_WORDS) {
    let startIndex = 0;
    // biome-ignore lint: no-loop-over-regex, we need incremental search
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

export function computeSwearMetrics(
  sessionMetrics: SessionMetrics[],
  eventLoader: (sessionId: string) => Effect.Effect<readonly TimelineEvent[]>,
): Effect.Effect<SwearSummary> {
  return Effect.gen(function*() {
    const allMentions: SwearMention[] = [];

    for (const sm of sessionMetrics) {
      const events = yield* eventLoader(sm.id);
      const userMessages = events.filter((e) => {
        if (e.eventType !== "message") return false;
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(e.data);
        } catch {
          return false;
        }
        return parsed.role === "user";
      });

      let sessionMentions = 0;

      for (const msg of userMessages) {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(msg.data);
        } catch {
          continue;
        }
        const content = (parsed.content ?? parsed.text ?? "") as string;
        const matches = findSwearWords(content);
        sessionMentions += matches.length;

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
      }

      // Yield every 10 sessions to avoid blocking
      if (sessionMetrics.indexOf(sm) % 10 === 9) {
        yield* Effect.yieldNow();
      }
    }

    // Top words
    const wordCounts = new Map<string, number>();
    for (const m of allMentions) {
      wordCounts.set(m.word, (wordCounts.get(m.word) ?? 0) + 1);
    }
    const topWords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    // By project
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

    // Trend by date
    const dateMap = new Map<string, number>();
    for (const m of allMentions) {
      const date = new Date(m.createdAt).toISOString().split("T")[0]!;
      dateMap.set(date, (dateMap.get(date) ?? 0) + 1);
    }
    const swearTrend = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top sessions (most swear-heavy)
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
}

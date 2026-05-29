import { Context, Data, Effect, Layer } from "effect";
import { eq } from "drizzle-orm";

import { Database } from "~/db/service";
import * as schema from "~/db/schema";
import { SWEAR_WORDS } from "~/features/dashboard/services/swear-types";
import type { Entry } from "../ingest/adapter";

export class SwearMatError extends Data.TaggedError("SwearMatError")<{
  readonly cause: unknown;
  readonly message: string;
}> {}

function extractText(content: unknown): string {
  if (Array.isArray(content)) {
    return (content as Array<{ type: string; text?: string }>)
      .filter((c): c is { type: string; text: string } => c.type === "text" && !!c.text)
      .map((c) => c.text)
      .join(" ");
  }
  if (typeof content === "string") return content;
  return "";
}

function extractContext(text: string, index: number, wordLength: number, radius = 40): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + wordLength + radius);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";
  return snippet;
}

interface SwearRow {
  sessionId: string;
  projectName: string;
  sessionTitle: string | null;
  word: string;
  context: string;
  createdAt: number;
}

export class SwearMatsService extends Context.Service<
  SwearMatsService,
  {
    readonly materialise: (params: {
      sessionId: string;
      entries: readonly Entry[];
      projectName: string;
      sessionTitle: string | null;
    }) => Effect.Effect<void, SwearMatError>;
  }
>()("radius/SwearMatsService") {
  static readonly layer = Layer.effect(
    SwearMatsService,
    Effect.gen(function*() {
      const db = yield* Database;

      const materialise = Effect.fn("materialiseSessionSwears")(function*(params: {
        sessionId: string;
        entries: readonly Entry[];
        projectName: string;
        sessionTitle: string | null;
      }) {
        const { sessionId, entries, projectName, sessionTitle } = params;
        const result: SwearRow[] = [];

        const createdAt =
          entries.length > 0
            ? new Date(entries[0]!.timestamp).getTime()
            : Date.now();

        for (const entry of entries) {
          if (entry.type !== "message") continue;
          const msg = entry.message;
          if (!msg || msg.role !== "user") continue;

          const content = extractText(msg.content ?? msg.text);
          const lower = content.toLowerCase();

          for (const word of SWEAR_WORDS) {
            const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const matches = lower.matchAll(new RegExp(`\\b${escaped}\\b`, "gi"));
            for (const match of matches) {
              result.push({
                sessionId,
                projectName,
                sessionTitle,
                word,
                context: extractContext(content, match.index, word.length),
                createdAt,
              });
            }
          }
        }

        if (result.length === 0) return;

        yield* Effect.try({
          try: () =>
            db.delete(schema.swearEntry).where(eq(schema.swearEntry.sessionId, sessionId)).run(),
          catch: (cause) =>
            new SwearMatError({ cause, message: "Failed to clear existing swear entries" }),
        });

        yield* Effect.try({
          try: () => db.insert(schema.swearEntry).values(result).run(),
          catch: (cause) =>
            new SwearMatError({ cause, message: "Failed to insert swear entries" }),
        });
      });

      return SwearMatsService.of({ materialise });
    }),
  );
}

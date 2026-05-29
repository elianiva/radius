import { Context, Data, Effect, Layer } from "effect";
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";

import type { Entry, ParsedSession } from "./adapter";

export class OpencodeError extends Data.TaggedError("OpencodeError")<{
  readonly cause: unknown;
  readonly message: string;
}> {}

interface OpencodeProject {
  readonly id: string;
  readonly name: string | null;
  readonly worktree: string;
  readonly time_created: number;
}

interface OpencodeSession {
  readonly id: string;
  readonly project_id: string;
  readonly title: string | null;
  readonly directory: string | null;
  readonly time_created: number;
  readonly time_archived: number | null;
}

interface OpencodeMessage {
  readonly id: string;
  readonly session_id: string;
  readonly time_created: number;
  readonly data: string;
}

interface OpencodePart {
  readonly id: string;
  readonly message_id: string;
  readonly session_id: string;
  readonly time_created: number;
  readonly data: string;
}

function openDb() {
  const dbPath = join(homedir(), ".local/share/opencode/opencode.db");
  return new DatabaseSync(dbPath, { readOnly: true });
}

function basename(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

function normaliseMessageData(raw: Record<string, unknown>): Record<string, unknown> {
  const normalised: Record<string, unknown> = { ...raw };

  if (raw.modelID && !raw.model) normalised.model = raw.modelID;
  if (raw.providerID && !raw.provider) normalised.provider = raw.providerID;
  if (raw.finish && !raw.stopReason) normalised.stopReason = raw.finish;

  if (raw.tokens && typeof raw.tokens === "object") {
    const t = raw.tokens as Record<string, unknown>;
    const input = (t.input as number) ?? 0;
    const output = (t.output as number) ?? 0;
    const cacheRead = ((t.cache as Record<string, unknown>)?.read as number) ?? 0;
    const cacheWrite = ((t.cache as Record<string, unknown>)?.write as number) ?? 0;
    normalised.usage = {
      input,
      output,
      cacheRead,
      cacheWrite,
      totalTokens: input + output,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: (raw.cost as number) ?? 0,
      },
    };
  }

  return normalised;
}

interface SessionProjectPair {
  readonly session: OpencodeSession;
  readonly project: OpencodeProject;
}

export class OpencodeAdapterService extends Context.Service<
  OpencodeAdapterService,
  {
    readonly getAllSessions: Effect.Effect<readonly SessionProjectPair[], OpencodeError>;
    readonly getSessionData: (
      sessionId: string,
    ) => Effect.Effect<ParsedSession, OpencodeError>;
  }
>()("radius/OpencodeAdapterService") {
  static readonly layer = Layer.effect(
    OpencodeAdapterService,
    Effect.gen(function* () {
      const getAllSessions = Effect.try({
        try: () => {
          const db = openDb();
          try {
            const sessionRows = db
              .prepare(
                `SELECT id, project_id, title, directory, time_created, time_archived
                 FROM session
                 ORDER BY time_created DESC`,
              )
              .all() as unknown as OpencodeSession[];

            if (sessionRows.length === 0) return [];

            const projectIds = [...new Set(sessionRows.map((s) => s.project_id))];
            const placeholders = projectIds.map(() => "?").join(",");
            const projectRows = db
              .prepare(
                `SELECT id, name, worktree, time_created
                 FROM project
                 WHERE id IN (${placeholders})`,
              )
              .all(...projectIds) as unknown as OpencodeProject[];

            const projectMap = new Map(projectRows.map((p) => [p.id, p] as const));

            return sessionRows
              .map((session) => {
                const project = projectMap.get(session.project_id);
                if (!project) return null;
                return { session, project } as SessionProjectPair;
              })
              .filter((r): r is SessionProjectPair => r !== null);
          } finally {
            db.close();
          }
        },
        catch: (cause) =>
          new OpencodeError({ cause, message: "Failed to get sessions" }),
      });

      const getSessionData = Effect.fn("getSessionData")(function* (sessionId: string) {
        const parsed = yield* Effect.try({
          try: () => {
            const db = openDb();
            try {
              const sessionRow = db
                .prepare("SELECT * FROM session WHERE id = ?")
                .get(sessionId) as OpencodeSession | undefined;

              if (!sessionRow) {
                throw new Error(`Session not found: ${sessionId}`);
              }

              const projectRow = db
                .prepare("SELECT * FROM project WHERE id = ?")
                .get(sessionRow.project_id) as OpencodeProject | undefined;

              const cwd = projectRow?.worktree ?? sessionRow.directory ?? "/unknown";
              const projectName = projectRow?.name ?? basename(cwd);

              const msgRows = db
                .prepare(
                  "SELECT id, session_id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created ASC",
                )
                .all(sessionId) as unknown as OpencodeMessage[];

              const partRows = db
                .prepare(
                  "SELECT id, message_id, session_id, time_created, data FROM part WHERE session_id = ? ORDER BY time_created ASC",
                )
                .all(sessionId) as unknown as OpencodePart[];

              const partsByMsg = new Map<string, OpencodePart[]>();
              for (const part of partRows) {
                const existing = partsByMsg.get(part.message_id) ?? [];
                existing.push(part);
                partsByMsg.set(part.message_id, existing);
              }

              const entries: Entry[] = [];
              const title = sessionRow.title ?? undefined;

              for (const msg of msgRows) {
                const msgData = JSON.parse(msg.data) as Record<string, unknown>;
                const normalised = normaliseMessageData(msgData);
                const parts = partsByMsg.get(msg.id) ?? [];

                const contentParts: Record<string, unknown>[] = [];

                for (const part of parts) {
                  const partData = JSON.parse(part.data) as Record<string, unknown>;
                  const partType = partData.type as string;

                  if (partType === "step-start") {
                    entries.push({
                      type: "step_start",
                      id: part.id,
                      parentId: msg.id,
                      timestamp: msToIso(part.time_created),
                      data: partData,
                    });
                  } else if (partType === "step-finish") {
                    entries.push({
                      type: "step_finish",
                      id: part.id,
                      parentId: msg.id,
                      timestamp: msToIso(part.time_created),
                      data: partData,
                    });
                  } else {
                    contentParts.push(partData);
                  }
                }

                const messageEntry: Record<string, unknown> = {
                  ...normalised,
                };

                if (contentParts.length > 0) {
                  messageEntry.content = contentParts;
                }

                entries.push({
                  type: "message",
                  id: msg.id,
                  parentId: (normalised.parentID as string) ?? null,
                  timestamp: msToIso(msg.time_created),
                  message: messageEntry,
                });
              }

              let eventCount = 0;
              let sessionEventCount = 0;
              for (const entry of entries) {
                if (entry.type === "message") eventCount++;
                else sessionEventCount++;
              }

              const firstUserMessage = entries.find(
                (e) =>
                  e.type === "message" &&
                  (e.message as Record<string, unknown>)?.role === "user",
              );
              let derivedTitle = title;
              if (!derivedTitle && firstUserMessage) {
                const msgData = firstUserMessage.message as Record<string, unknown> | undefined;
                if (msgData) {
                  const content = msgData.content as string | undefined;
                  if (content) derivedTitle = content.slice(0, 80);
                }
              }

              return {
                header: {
                  type: "session" as const,
                  version: 1,
                  id: sessionRow.id,
                  timestamp: msToIso(sessionRow.time_created),
                  cwd,
                },
                entries,
                title: derivedTitle,
                projectName,
                eventCount,
                sessionEventCount,
              } satisfies ParsedSession;
            } finally {
              db.close();
            }
          },
          catch: (cause) =>
            new OpencodeError({
              cause,
              message: `Failed to parse session data: ${sessionId}`,
            }),
        });

        return parsed;
      });

      return OpencodeAdapterService.of({ getAllSessions, getSessionData });
    }),
  );
}

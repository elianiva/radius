import { Context, Data, Effect, Layer } from "effect";
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";

import type { Entry, ParsedSession } from "./adapter";

export class OpencodeError extends Data.TaggedError("OpencodeError")<{
  readonly cause: unknown;
  readonly message: string;
}> {}

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

function buildSession(
  sessionRow: {
    id: string; project_id: string; title: string | null;
    directory: string | null; time_created: number;
  },
  projectRow: { worktree: string | null; name: string | null } | undefined,
  msgRows: ReadonlyArray<{ id: string; time_created: number; data: string }>,
  partRows: ReadonlyArray<{ id: string; message_id: string; time_created: number; data: string }>,
): ParsedSession {
  const cwd = projectRow?.worktree ?? sessionRow.directory ?? "/unknown";
  const projectName = projectRow?.name ?? basename(cwd);

  const partsByMsg = new Map<string, (typeof partRows)[number][]>();
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
}

export class OpencodeAdapterService extends Context.Service<
  OpencodeAdapterService,
  {
    readonly parseAll: Effect.Effect<readonly ParsedSession[], OpencodeError>;
  }
>()("radius/OpencodeAdapterService") {
  static readonly layer = Layer.effect(
    OpencodeAdapterService,
    Effect.gen(function* () {
      const dbPath = join(homedir(), ".local/share/opencode/opencode.db");

      const parseAll = Effect.try({
        try: () => {
          const db = new DatabaseSync(dbPath, { readOnly: true });

          try {
            const sessionRows = db
              .prepare(
                `SELECT id, project_id, title, directory, time_created
                 FROM session ORDER BY time_created ASC`,
              )
              .all() as Array<{
                id: string; project_id: string; title: string | null;
                directory: string | null; time_created: number;
              }>;

            if (sessionRows.length === 0) return [];

            const projectIds = [...new Set(sessionRows.map((s) => s.project_id))];
            const projectRows =
              projectIds.length > 0
                ? (db
                    .prepare(
                      `SELECT id, name, worktree FROM project WHERE id IN (${projectIds.map(() => "?").join(",")})`,
                    )
                    .all(...projectIds) as Array<{
                      id: string; name: string | null; worktree: string | null;
                    }>)
                : [];
            const projectMap = new Map(projectRows.map((p) => [p.id, p] as const));

            const msgStmt = db.prepare(
              "SELECT id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created ASC",
            );
            const partStmt = db.prepare(
              "SELECT id, message_id, time_created, data FROM part WHERE session_id = ? ORDER BY time_created ASC",
            );

            const results: ParsedSession[] = [];
            for (const sessionRow of sessionRows) {
              try {
                const project = projectMap.get(sessionRow.project_id);
                const msgs = msgStmt.all(sessionRow.id) as Array<{
                  id: string; time_created: number; data: string;
                }>;
                const parts = partStmt.all(sessionRow.id) as Array<{
                  id: string; message_id: string; time_created: number; data: string;
                }>;
                results.push(buildSession(sessionRow, project, msgs, parts));
              } catch (error) {
                console.error(`opencode: skipping session ${sessionRow.id}: ${error}`);
              }
            }

            return results;
          } finally {
            db.close();
          }
        },
        catch: (cause) => new OpencodeError({ cause, message: String(cause) }),
      });

      return OpencodeAdapterService.of({ parseAll });
    }),
  );
}

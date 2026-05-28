import { Context, Data, Effect, Cause, FileSystem, Layer, Path, Queue, Ref, Stream } from "effect";
import { homedir } from "node:os";

import * as schema from "~/db/schema";
import { Database } from "~/db/service";

export class PiIngestError extends Data.TaggedError("PiIngestError")<{
  readonly cause: unknown;
  readonly message: string;
}> {}

interface SessionHeader {
  type: "session";
  version: number;
  id: string;
  timestamp: string;
  cwd: string;
}

interface Entry {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
  [key: string]: unknown;
}

function parseTimestamp(ts: string): number {
  return new Date(ts).getTime();
}

interface MessageContent {
  readonly type: string;
  readonly text?: string;
}

function extractTextContent(content: unknown): string | undefined {
  if (Array.isArray(content)) {
    const text = (content as MessageContent[])
      .filter((c): c is MessageContent & { text: string } => c.type === "text" && !!c.text)
      .map((c) => c.text)
      .join(" ");
    return text.length > 0 ? text.slice(0, 80) : undefined;
  }
  if (typeof content === "string") {
    return content.slice(0, 80);
  }
  return undefined;
}

export type IngestProgress =
  | { readonly stage: "finding-sessions" }
  | {
      readonly stage: "importing-session";
      readonly sessionId: string;
      readonly project: string;
      readonly sessionIndex: number;
      readonly totalSessions: number;
    }
  | {
      readonly stage: "done";
      readonly result: {
        readonly files: number;
        readonly sessions: number;
        readonly projects: number;
        readonly events: number;
        readonly sessionEvents: number;
      };
    };

type PiAdapterServiceShape = {
  readonly ingest: Effect.Effect<Stream.Stream<IngestProgress, PiIngestError>>;
};

export class PiAdapterService extends Context.Service<PiAdapterService, PiAdapterServiceShape>()(
  "radius/PiAdapterService",
) {
  static readonly layer = Layer.effect(
    PiAdapterService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const db = yield* Database;

      const sessionsDir = path.join(homedir(), ".pi/agent/sessions");

      const ingest = Stream.callback<IngestProgress, PiIngestError>(
        (queue: Queue.Enqueue<IngestProgress, PiIngestError | Cause.Done>) =>
          Effect.gen(function* () {
            yield* Effect.logInfo("pi.ingest: Finding sessions");
            yield* Queue.offer(queue, { stage: "finding-sessions" });

            const dirEntries = yield* fs
              .readDirectory(sessionsDir)
              .pipe(
                Effect.mapError(
                  (cause) =>
                    new PiIngestError({ cause, message: "Failed to read sessions directory" }),
                ),
              );

            const statResults = yield* Effect.all(
              dirEntries.map((dirName) => {
                const dirPath = path.join(sessionsDir, dirName);
                return fs.stat(dirPath).pipe(
                  Effect.mapError(
                    (cause) =>
                      new PiIngestError({
                        cause,
                        message: `Failed to stat session directory: ${dirPath}`,
                      }),
                  ),
                  Effect.map((stat) =>
                    stat.type === "Directory" ? { name: dirName, path: dirPath } : null,
                  ),
                );
              }),
              { concurrency: 10 },
            );

            const sessionDirs = statResults.filter(
              (r): r is { name: string; path: string } => r !== null,
            );

            const jsonlResults = yield* Effect.all(
              sessionDirs.map((sessionDir) =>
                fs.readDirectory(sessionDir.path).pipe(
                  Effect.mapError(
                    (cause) =>
                      new PiIngestError({
                        cause,
                        message: `Failed to read session directory: ${sessionDir.path}`,
                      }),
                  ),
                  Effect.map((files) =>
                    files
                      .filter((f) => f.endsWith(".jsonl"))
                      .map((file) => ({ dir: sessionDir.path, file })),
                  ),
                ),
              ),
              { concurrency: 10 },
            );

            const allJsonlFiles = jsonlResults.flat();
            const totalSessions = allJsonlFiles.length;
            const progressRef = yield* Ref.make({
              files: 0,
              projects: 0,
              events: 0,
              sessionEvents: 0,
            });

            const knownEventTypes = new Set([
              "model_change",
              "compaction",
              "branch_summary",
              "session_info",
              "label",
            ]);

            yield* Effect.all(
              allJsonlFiles.map(({ dir: dirPath, file }, idx) =>
                Effect.gen(function* () {
                  const filePath = path.join(dirPath, file);
                  const content = yield* fs.readFileString(filePath).pipe(
                    Effect.mapError(
                      (cause) =>
                        new PiIngestError({
                          cause,
                          message: `Failed to read session file: ${filePath}`,
                        }),
                    ),
                  );

                  const lines = content.split("\n").filter(Boolean);
                  if (lines.length === 0) return;

                  const header: SessionHeader = JSON.parse(lines[0]);
                  if (header.type !== "session") return;

                  const entries = lines.slice(1).map((l) => JSON.parse(l) as Entry);

                  const firstUserMessage = entries.find(
                    (e) =>
                      e.type === "message" &&
                      (e.message as Record<string, unknown>)?.role === "user",
                  );
                  const title = firstUserMessage
                    ? extractTextContent(
                        (firstUserMessage.message as Record<string, unknown>)?.content,
                      )
                    : undefined;

                  const sessionIndex = idx + 1;
                  const projectName = path.basename(header.cwd);
                  const now = Date.now();

                  yield* Queue.offer(queue, {
                    stage: "importing-session",
                    sessionId: header.id,
                    project: projectName,
                    sessionIndex,
                    totalSessions,
                  });

                  yield* Effect.try({
                    try: () =>
                      db
                        .insert(schema.project)
                        .values({
                          id: header.cwd,
                          name: projectName,
                          createdAt: now,
                          updatedAt: now,
                        })
                        .onConflictDoNothing()
                        .run(),
                    catch: (cause) =>
                      new PiIngestError({
                        cause,
                        message: `Failed to insert project: ${header.cwd}`,
                      }),
                  });

                  yield* Effect.try({
                    try: () =>
                      db
                        .insert(schema.session)
                        .values({
                          id: header.id,
                          agent: "Pi",
                          projectId: header.cwd,
                          directory: header.cwd,
                          title,
                          createdAt: parseTimestamp(header.timestamp),
                          updatedAt: now,
                        })
                        .onConflictDoNothing()
                        .run(),
                    catch: (cause) =>
                      new PiIngestError({
                        cause,
                        message: `Failed to insert session: ${header.id}`,
                      }),
                  });

                  const entryEffects = entries.map((entry) =>
                    Effect.suspend(() => {
                      const data =
                        entry.type === "message"
                          ? (entry.message as Record<string, unknown>)
                          : { ...entry };
                      delete data.id;
                      delete data.parentId;
                      delete data.timestamp;
                      delete data.type;

                      if (entry.type === "message") {
                        return Effect.try({
                          try: () =>
                            db
                              .insert(schema.event)
                              .values({
                                id: entry.id,
                                sessionId: header.id,
                                parentId: entry.parentId,
                                eventType: "message",
                                createdAt: parseTimestamp(entry.timestamp),
                                data: JSON.stringify(data),
                              })
                              .onConflictDoNothing()
                              .run(),
                          catch: (cause) =>
                            new PiIngestError({
                              cause,
                              message: `Failed to insert message event: ${entry.id}`,
                            }),
                        });
                      }

                      const eventType =
                        entry.type === "thinking_level_change"
                          ? "thinking_change"
                          : knownEventTypes.has(entry.type)
                            ? entry.type
                            : "custom";

                      return Effect.try({
                        try: () =>
                          db
                            .insert(schema.sessionEvent)
                            .values({
                              id: entry.id,
                              sessionId: header.id,
                              eventType,
                              createdAt: parseTimestamp(entry.timestamp),
                              data: JSON.stringify(data),
                            })
                            .onConflictDoNothing()
                            .run(),
                        catch: (cause) =>
                          new PiIngestError({
                            cause,
                            message: `Failed to insert session event: ${entry.id}`,
                          }),
                      });
                    }),
                  );

                  const matchTags = yield* Effect.all(
                    entryEffects.map((eff) =>
                      Effect.matchEffect(eff, {
                        onSuccess: () => Effect.succeed("event" as const),
                        onFailure: (e) => Effect.fail(e),
                      }),
                    ),
                    { concurrency: 10 },
                  );

                  let events = 0;
                  let sessionEvents = 0;
                  for (const tag of matchTags) {
                    if (tag === "event") events++;
                    else sessionEvents++;
                  }

                  yield* Ref.update(progressRef, (p) => ({
                    files: p.files + 1,
                    projects: p.projects + 1,
                    events: p.events + events,
                    sessionEvents: p.sessionEvents + sessionEvents,
                  }));
                }),
              ),
              { concurrency: 10 },
            );

            const totals = yield* Ref.get(progressRef);

            yield* Effect.logInfo("Ingest complete").pipe(
              Effect.annotateLogs({
                files: totals.files,
                sessions: totalSessions,
                projects: totals.projects,
                events: totals.events,
                sessionEvents: totals.sessionEvents,
              }),
            );

            yield* Queue.offer(queue, {
              stage: "done",
              result: {
                files: totals.files,
                sessions: totalSessions,
                projects: totals.projects,
                events: totals.events,
                sessionEvents: totals.sessionEvents,
              },
            });

            yield* Queue.end(queue);
          }),
      );

      return PiAdapterService.of({ ingest: Effect.succeed(ingest) });
    }),
  );
}

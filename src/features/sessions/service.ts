import { Context, Effect, Layer, Queue, Stream, Cause } from "effect";

import { PiAdapterService, PiIngestError } from "./ingest/pi";
import { PersistService, PersistError } from "./ingest/persist";
import { MaterialisationService } from "./materialisation/service";
import type { IngestProgress } from "./progress";
import type { SummaryError } from "./materialisation/summary";
import type { SwearMatError } from "./materialisation/swear";

export type IngestError =
  | PiIngestError
  | PersistError
  | SummaryError
  | SwearMatError;

export class IngestService extends Context.Service<
  IngestService,
  { readonly ingest: Effect.Effect<Stream.Stream<IngestProgress, IngestError>> }
>()("radius/IngestService") {
  static readonly layer = Layer.effect(
    IngestService,
    Effect.gen(function*() {
      const adapter = yield* PiAdapterService;
      const persist = yield* PersistService;
      const mat = yield* MaterialisationService;

      const ingest = Stream.callback<IngestProgress, IngestError>(
        (queue: Queue.Queue<IngestProgress, IngestError | Cause.Done>) =>
          Effect.gen(function*() {
            yield* Effect.logInfo("pi.ingest: Finding sessions");

            yield* Queue.offer(queue, {
              stage: "finding-sessions",
              label: "Scanning for sessions",
              description: "Looking through your pi data",
            });

            const { files, totalSessions } = yield* adapter.discover;

            const seenProjects = new Set<string>();
            let events = 0;
            let sessionEvents = 0;

            for (let idx = 0; idx < files.length; idx++) {
              const fileInfo = files[idx]!;
              const sessionIndex = idx + 1;

              const parsed = yield* adapter.parse(fileInfo);
              events += parsed.eventCount;
              sessionEvents += parsed.sessionEventCount;
              seenProjects.add(parsed.header.cwd);

              yield* persist.persist(parsed);
              yield* mat.materialiseSession(parsed);
              console.log('DEBUG: materialised');

              yield* Effect.logInfo("pi.ingest: Imported session").pipe(
                Effect.annotateLogs({
                  sessionId: parsed.header.id,
                  projectName: parsed.projectName,
                  sessionIndex,
                  totalSessions,
                }),
              );

              yield* Queue.offer(queue, {
                stage: "importing-session",
                label: `Importing ${parsed.projectName}`,
                description: `Session ${sessionIndex} of ${totalSessions}`,
                sessionId: parsed.header.id,
                project: parsed.projectName,
                sessionIndex,
                totalSessions,
              } as IngestProgress);
            }

            yield* Effect.logInfo("pi.ingest: Complete").pipe(
              Effect.annotateLogs({
                files: totalSessions,
                sessions: totalSessions,
                projects: seenProjects.size,
                events,
                sessionEvents,
              }),
            );

            yield* Queue.offer(queue, {
              stage: "done",
              label: "Import complete",
              description: `${totalSessions} sessions imported`,
              result: {
                files: totalSessions,
                sessions: totalSessions,
                projects: seenProjects.size,
                events,
                sessionEvents,
              },
            } as IngestProgress);

            yield* Queue.end(queue);
          }),
      );

      return IngestService.of({ ingest: Effect.succeed(ingest) });
    }),
  );
}

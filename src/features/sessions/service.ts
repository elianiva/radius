import { Context, Effect, Layer, Queue, Stream, Cause } from "effect";

import { PiAdapterService, PiIngestError } from "./ingest/pi";
import { OpencodeAdapterService, OpencodeError } from "./ingest/opencode";
import { PersistService, PersistError } from "./ingest/persist";
import { MaterialisationService } from "./materialisation/service";
import type { IngestProgress } from "./progress";
import type { SummaryError } from "./materialisation/summary";
import type { SwearMatError } from "./materialisation/swear";

export type IngestError =
	| PiIngestError
	| OpencodeError
	| PersistError
	| SummaryError
	| SwearMatError;

export class IngestService extends Context.Service<
	IngestService,
	{
		readonly ingestPi: Effect.Effect<Stream.Stream<IngestProgress, IngestError>>;
		readonly ingestOpencode: Effect.Effect<Stream.Stream<IngestProgress, IngestError>>;
	}
>()("radius/IngestService") {
	static readonly layer = Layer.effect(
		IngestService,
		Effect.gen(function* () {
			const piAdapter = yield* PiAdapterService;
			const opencodeAdapter = yield* OpencodeAdapterService;
			const persist = yield* PersistService;
			const mat = yield* MaterialisationService;

			const ingestPi = Stream.callback<IngestProgress, IngestError>(
				(queue: Queue.Queue<IngestProgress, IngestError | Cause.Done>) =>
					Effect.gen(function* () {
						yield* Effect.logInfo("pi.ingest: Finding sessions");

						yield* Queue.offer(queue, {
							stage: "finding-sessions",
							label: "Scanning for sessions",
							description: "Looking through your pi data",
						});

						const { files, totalSessions } = yield* piAdapter.discover;

						const seenProjects = new Set<string>();
						let events = 0;
						let sessionEvents = 0;

						for (let idx = 0; idx < files.length; idx++) {
							const fileInfo = files[idx]!;
							const sessionIndex = idx + 1;

							const parsed = yield* piAdapter.parse(fileInfo);
							events += parsed.eventCount;
							sessionEvents += parsed.sessionEventCount;
							seenProjects.add(parsed.header.cwd);

							yield* persist.persist(parsed);
							yield* mat.materialiseSession(parsed);

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
								source: "pi",
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

			const ingestOpencode = Stream.callback<IngestProgress, IngestError>(
				(queue: Queue.Queue<IngestProgress, IngestError | Cause.Done>) =>
					Effect.gen(function* () {
						yield* Effect.logInfo("opencode.ingest: Scanning sessions");

						yield* Queue.offer(queue, {
							stage: "opencode-discovering",
							label: "Scanning opencode sessions",
							description: "Reading from opencode database",
						} as IngestProgress);

						const seenProjects = new Set<string>();
						let totalSessions = 0;
						let totalEvents = 0;
						let totalSessionEvents = 0;

						yield* opencodeAdapter.forEachSession((parsed, sessionIndex, total) => {
							totalSessions = total;
							totalEvents += parsed.eventCount;
							totalSessionEvents += parsed.sessionEventCount;
							seenProjects.add(parsed.header.cwd);

							// Ignore persist/materialise errors — log and continue
							const persist_ = persist.persist(parsed).pipe(
								Effect.catch((err) =>
									Effect.gen(function* () {
										yield* Effect.logError("opencode: persist failed", err);
									}),
								),
							);
							const mats_ = mat.materialiseSession(parsed).pipe(
								Effect.catch((err) =>
									Effect.gen(function* () {
										yield* Effect.logError("opencode: materialise failed", err);
									}),
								),
							);

							return Effect.gen(function* () {
								yield* persist_;
								yield* mats_;

								yield* Effect.logInfo("opencode.ingest: Imported session").pipe(
									Effect.annotateLogs({
										sessionId: parsed.header.id,
										projectName: parsed.projectName,
										sessionIndex,
										total,
									}),
								);

								yield* Queue.offer(queue, {
									stage: "importing-session",
									label: `Importing ${parsed.projectName}`,
									description: `Session ${sessionIndex} of ${total}`,
									source: "opencode",
									sessionId: parsed.header.id,
									project: parsed.projectName,
									sessionIndex,
									totalSessions: total,
								} as IngestProgress);
							});
						});

						yield* Effect.logInfo("opencode.ingest: Complete").pipe(
							Effect.annotateLogs({
								sessions: totalSessions,
								projects: seenProjects.size,
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
								events: totalEvents,
								sessionEvents: totalSessionEvents,
							},
						} as IngestProgress);

						yield* Queue.end(queue);
					}),
			);

			return IngestService.of({
				ingestPi: Effect.succeed(ingestPi),
				ingestOpencode: Effect.succeed(ingestOpencode),
			});
		}),
	);
}

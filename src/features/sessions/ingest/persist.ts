import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import * as schema from "~/db/schema";
import type { ParsedSession } from "./adapter";

export class PersistError extends Data.TaggedError("PersistError")<{
	readonly cause: unknown;
	readonly message: string;
}> {}

const knownEventTypes = new Set([
	"model_change",
	"compaction",
	"branch_summary",
	"session_info",
	"label",
]);

function mapEventType(entryType: string): string {
	if (entryType === "thinking_level_change") return "thinking_change";
	if (entryType === "step_start") return "step_start";
	if (entryType === "step_finish") return "step_finish";
	if (knownEventTypes.has(entryType)) return entryType;
	return "custom";
}

function detectAgent(sessionId: string): string {
	return sessionId.startsWith("ses_") ? "opencode" : "pi";
}

function cleanEntryData(entry: Record<string, unknown>): Record<string, unknown> {
	const base = (entry.message as Record<string, unknown> | undefined) ?? entry;
	const { id: _, parentId: _p, timestamp: _t, type: _tp, message: _m, ...rest } = base;
	return rest;
}

const BATCH_SIZE = 200;

export class PersistService extends Context.Service<
	PersistService,
	{ readonly persist: (session: ParsedSession) => Effect.Effect<void, PersistError> }
>()("radius/PersistService") {
	static readonly layer = Layer.effect(
		PersistService,
		Effect.gen(function* () {
			const db = yield* Database;

			const persist = Effect.fn("persistSession")(function* (session: ParsedSession) {
				const now = Date.now();
				yield* Effect.try({
					try: () =>
						db
							.insert(schema.project)
							.values({
								id: session.header.cwd,
								name: session.projectName,
								createdAt: now,
								updatedAt: now,
							})
							.onConflictDoNothing()
							.run(),
					catch: (cause) => new PersistError({ cause, message: "Failed to upsert project" }),
				});

				const agent = detectAgent(session.header.id);

				yield* Effect.try({
					try: () =>
						db
							.insert(schema.session)
							.values({
								id: session.header.id,
								agent,
								projectId: session.header.cwd,
								directory: session.header.cwd,
								title: session.title,
								createdAt: new Date(session.header.timestamp).getTime(),
								updatedAt: now,
							})
							.onConflictDoNothing()
							.run(),
					catch: (cause) => new PersistError({ cause, message: "Failed to upsert session" }),
				});

				// Batch entries into bulk inserts to avoid per-row Effect overhead
				const eventRows: Array<{
					id: string;
					sessionId: string;
					parentId: string | null;
					eventType: string;
					createdAt: number;
					data: string;
				}> = [];
				const sessionEventRows: Array<{
					id: string;
					sessionId: string;
					eventType: string;
					createdAt: number;
					data: string;
				}> = [];

				for (const entry of session.entries) {
					const data = cleanEntryData(entry);
					const entryType = entry.type as string;
					const mappedType = mapEventType(entryType);
					const serialized = JSON.stringify(data);

					if (
						entryType === "message" ||
						entryType === "step_start" ||
						entryType === "step_finish"
					) {
						eventRows.push({
							id: entry.id,
							sessionId: session.header.id,
							parentId: entry.parentId,
							eventType: mappedType,
							createdAt: new Date(entry.timestamp).getTime(),
							data: serialized,
						});
					} else {
						sessionEventRows.push({
							id: entry.id,
							sessionId: session.header.id,
							eventType: mappedType,
							createdAt: new Date(entry.timestamp).getTime(),
							data: serialized,
						});
					}
				}

				for (let i = 0; i < eventRows.length; i += BATCH_SIZE) {
					const batch = eventRows.slice(i, i + BATCH_SIZE);
					yield* Effect.try({
						try: () => db.insert(schema.event).values(batch).onConflictDoNothing().run(),
						catch: (cause) => new PersistError({ cause, message: "Failed to batch insert events" }),
					});
				}

				for (let i = 0; i < sessionEventRows.length; i += BATCH_SIZE) {
					const batch = sessionEventRows.slice(i, i + BATCH_SIZE);
					yield* Effect.try({
						try: () => db.insert(schema.sessionEvent).values(batch).onConflictDoNothing().run(),
						catch: (cause) =>
							new PersistError({ cause, message: "Failed to batch insert session events" }),
					});
				}
			});

			return PersistService.of({ persist });
		}),
	);
}

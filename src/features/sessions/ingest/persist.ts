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

				for (const entry of session.entries) {
					const data = cleanEntryData(entry);
					const entryType = entry.type as string;
					const mappedType = mapEventType(entryType);

					// step_start and step_finish go into event table (conversation control flow)
					// everything else follows the existing mapping
					if (
						entryType === "message" ||
						entryType === "step_start" ||
						entryType === "step_finish"
					) {
						yield* Effect.try({
							try: () =>
								db
									.insert(schema.event)
									.values({
										id: entry.id,
										sessionId: session.header.id,
										parentId: entry.parentId,
										eventType: mappedType,
										createdAt: new Date(entry.timestamp).getTime(),
										data: JSON.stringify(data),
									})
									.onConflictDoNothing()
									.run(),
							catch: (cause) => new PersistError({ cause, message: "Failed to upsert event" }),
						});
					} else {
						yield* Effect.try({
							try: () =>
								db
									.insert(schema.sessionEvent)
									.values({
										id: entry.id,
										sessionId: session.header.id,
										eventType: mappedType,
										createdAt: new Date(entry.timestamp).getTime(),
										data: JSON.stringify(data),
									})
									.onConflictDoNothing()
									.run(),
							catch: (cause) =>
								new PersistError({ cause, message: "Failed to upsert session event" }),
						});
					}
				}
			});

			return PersistService.of({ persist });
		}),
	);
}

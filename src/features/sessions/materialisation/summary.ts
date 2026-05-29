import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import * as schema from "~/db/schema";
import type { Entry, SessionHeader } from "../ingest/adapter";

export class SummaryError extends Data.TaggedError("SummaryError")<{
	readonly cause: unknown;
	readonly message: string;
}> {}

interface Usage {
	readonly input: number;
	readonly output: number;
	readonly cacheRead: number;
	readonly cacheWrite: number;
	readonly totalTokens: number;
	readonly cost: {
		readonly input: number;
		readonly output: number;
		readonly cacheRead: number;
		readonly cacheWrite: number;
		readonly total: number;
	};
}

function isUsage(value: unknown): value is Usage {
	return (
		typeof value === "object" &&
		value !== null &&
		"totalTokens" in value &&
		typeof (value as Record<string, unknown>).totalTokens === "number"
	);
}

function computeSummary(
	header: SessionHeader,
	entries: readonly Entry[],
): Omit<typeof schema.sessionSummary.$inferInsert, "id"> & { id: string } {
	let userMsgCount = 0;
	let asstMsgCount = 0;
	let toolCallCount = 0;
	let toolErrorCount = 0;
	let totalTokens = 0;
	let totalCost = 0;
	const models = new Set<string>();
	const stopReasons: Record<string, number> = {};
	let lastTs = new Date(header.timestamp).getTime();

	for (const entry of entries) {
		if (entry.type !== "message") continue;
		const msg = entry.message;
		if (!msg) continue;

		const role = msg.role as string | undefined;
		if (!role) continue;

		const ts = new Date(entry.timestamp).getTime();
		if (ts > lastTs) lastTs = ts;

		if (role === "user") {
			userMsgCount++;
		} else if (role === "assistant") {
			asstMsgCount++;
			if (msg.model) models.add(msg.model as string);
			if (isUsage(msg.usage)) {
				totalTokens += msg.usage.totalTokens;
				totalCost += msg.usage.cost.total;
			}
			if (msg.stopReason) {
				const reason = msg.stopReason as string;
				stopReasons[reason] = (stopReasons[reason] ?? 0) + 1;
			}
		} else if (role === "toolResult") {
			toolCallCount++;
			if (msg.isError) toolErrorCount++;
		}
	}

	const createdAt = new Date(header.timestamp).getTime();
	const duration = lastTs - createdAt;

	return {
		id: header.id,
		projectId: header.cwd,
		createdAt,
		duration: Math.max(0, duration),
		messageCount: userMsgCount + asstMsgCount,
		userMsgCount,
		asstMsgCount,
		toolCallCount,
		toolErrorCount,
		totalTokens,
		totalCost,
		models: JSON.stringify(Array.from(models)),
		stopReasons: JSON.stringify(stopReasons),
	};
}

export class SessionSummaryMatsService extends Context.Service<
	SessionSummaryMatsService,
	{
		readonly materialise: (params: {
			header: SessionHeader;
			entries: readonly Entry[];
			projectName: string;
		}) => Effect.Effect<void, SummaryError>;
	}
>()("radius/SessionSummaryMatsService") {
	static readonly layer = Layer.effect(
		SessionSummaryMatsService,
		Effect.gen(function* () {
			const db = yield* Database;

			const materialise = Effect.fn("materialiseSessionSummary")(function* ({
				header,
				entries,
			}: {
				header: SessionHeader;
				entries: readonly Entry[];
				projectName: string;
			}) {
				const summary = computeSummary(header, entries);

				yield* Effect.try({
					try: () =>
						db
							.insert(schema.sessionSummary)
							.values(summary)
							.onConflictDoUpdate({
								target: schema.sessionSummary.id,
								set: {
									projectId: summary.projectId,
									createdAt: summary.createdAt,
									duration: summary.duration,
									messageCount: summary.messageCount,
									userMsgCount: summary.userMsgCount,
									asstMsgCount: summary.asstMsgCount,
									toolCallCount: summary.toolCallCount,
									toolErrorCount: summary.toolErrorCount,
									totalTokens: summary.totalTokens,
									totalCost: summary.totalCost,
									models: summary.models,
									stopReasons: summary.stopReasons,
								},
							})
							.run(),
					catch: (cause) =>
						new SummaryError({ cause, message: "Failed to upsert session summary" }),
				});
			});

			return SessionSummaryMatsService.of({ materialise });
		}),
	);
}

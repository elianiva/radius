import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import { session } from "~/db/schema";
import { SQL, and, desc, eq, isNull, isNotNull, lt } from "drizzle-orm";
import { event, sessionEvent } from "~/db/schema";
import type { Session } from "~/db/schema";

export interface TimelineEvent {
	readonly id: string;
	readonly sessionId: string;
	readonly eventType: string;
	readonly createdAt: number;
	readonly data: string;
}

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

export interface SessionMetrics {
	readonly id: string;
	readonly title: string | null;
	readonly directory: string;
	readonly projectId: string;
	readonly projectName: string;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly duration: number;
	readonly messageCount: number;
	readonly userMessageCount: number;
	readonly assistantMessageCount: number;
	readonly toolCallCount: number;
	readonly toolErrorCount: number;
	readonly totalTokens: number;
	readonly totalCost: number;
	readonly models: string[];
	readonly stopReasons: Record<string, number>;
}

export class SessionError extends Data.TaggedError("SessionError")<{
	readonly cause: unknown;
	readonly message: string;
}> {}

const MAX_PAGE_SIZE = 100;

export interface Paginated<S> {
	readonly items: S[];
	readonly cursor: string | null;
}

interface SessionServiceShape {
	readonly list: (params: {
		readonly cursor?: string;
		readonly limit?: number;
		readonly agent?: string;
		readonly archived?: boolean;
	}) => Effect.Effect<Paginated<Session>, SessionError>;

	readonly getEvents: (params: {
		readonly sessionId: string;
	}) => Effect.Effect<readonly TimelineEvent[], SessionError>;

	readonly computeSessionMetrics: (params: {
		readonly session: Session;
		readonly projectName: string;
	}) => Effect.Effect<SessionMetrics, SessionError>;
}

export class SessionService extends Context.Service<SessionService, SessionServiceShape>()(
	"radius/SessionService",
) {
	static readonly layer = Layer.effect(
		SessionService,
		Effect.gen(function* () {
			const db = yield* Database;

			const getEvents = Effect.fn("getEvents")(function* (params: { readonly sessionId: string }) {
				const [eventRows, sessionEventRows] = yield* Effect.try({
					try: () => [
						db.select().from(event).where(eq(event.sessionId, params.sessionId)).all(),
						db
							.select()
							.from(sessionEvent)
							.where(eq(sessionEvent.sessionId, params.sessionId))
							.all(),
					],
					catch: (cause) => new SessionError({ cause, message: "Failed to get events" }),
				});

				const normalized = [
					...eventRows.map((r) => ({
						id: r.id,
						sessionId: r.sessionId,
						eventType: r.eventType,
						createdAt: r.createdAt,
						data: r.data,
					})),
					...sessionEventRows.map((r) => ({
						id: r.id,
						sessionId: r.sessionId,
						eventType: r.eventType,
						createdAt: r.createdAt,
						data: r.data,
					})),
				];

				normalized.sort((a, b) => a.createdAt - b.createdAt);

				return normalized;
			});

			const list = Effect.fn("list")(function* (params: {
				readonly cursor?: string;
				readonly limit?: number;
				readonly agent?: string;
				readonly archived?: boolean;
			}) {
				const limit = Math.min(params.limit ?? 50, MAX_PAGE_SIZE);
				const conditions: SQL[] = [];

				if (params.agent) conditions.push(eq(session.agent, params.agent));
				if (params.archived === true) {
					conditions.push(isNotNull(session.archivedAt));
				} else {
					conditions.push(isNull(session.archivedAt));
				}

				if (params.cursor) {
					conditions.push(lt(session.id, params.cursor));
				}

				const rows = yield* Effect.try({
					try: () =>
						db
							.select()
							.from(session)
							.where(and(...conditions))
							.orderBy(desc(session.id))
							.limit(limit + 1)
							.all(),
					catch: (cause) => new SessionError({ cause, message: "Failed to list sessions" }),
				});

				const hasMore = rows.length > limit;
				const items = hasMore ? rows.slice(0, limit) : rows;
				const cursor = hasMore ? items[items.length - 1].id : null;

				return { items, cursor };
			});

			const computeSessionMetrics = Effect.fn("computeSessionMetrics")(function* (params: {
				readonly session: Session;
				readonly projectName: string;
			}) {
				const events = yield* getEvents({ sessionId: params.session.id });

				let userMessageCount = 0;
				let assistantMessageCount = 0;
				let toolCallCount = 0;
				let toolErrorCount = 0;
				let totalTokens = 0;
				let totalCost = 0;
				const models = new Set<string>();
				const stopReasons: Record<string, number> = {};

				for (const evt of events) {
					let parsed: Record<string, unknown>;
					try {
						parsed = JSON.parse(evt.data);
					} catch {
						parsed = {};
					}

					if (evt.eventType === "message") {
						if (parsed.role === "user") {
							userMessageCount++;
						} else if (parsed.role === "assistant") {
							assistantMessageCount++;
							if (parsed.model) models.add(parsed.model as string);
							if (isUsage(parsed.usage)) {
								totalTokens += parsed.usage.totalTokens;
								totalCost += parsed.usage.cost.total;
							}
							if (parsed.stopReason) {
								stopReasons[parsed.stopReason as string] =
									(stopReasons[parsed.stopReason as string] ?? 0) + 1;
							}
						} else if (parsed.role === "toolResult") {
							toolCallCount++;
							if (parsed.isError) toolErrorCount++;
						}
					}
				}

				const duration =
					events.length > 0 ? events[events.length - 1]!.createdAt - params.session.createdAt : 0;

				return {
					id: params.session.id,
					title: params.session.title,
					directory: params.session.directory,
					projectId: params.session.projectId,
					projectName: params.projectName,
					createdAt: params.session.createdAt,
					updatedAt: params.session.updatedAt,
					duration,
					messageCount: userMessageCount + assistantMessageCount,
					userMessageCount,
					assistantMessageCount,
					toolCallCount,
					toolErrorCount,
					totalTokens,
					totalCost,
					models: Array.from(models),
					stopReasons,
				};
			});

			return SessionService.of({ list, getEvents, computeSessionMetrics });
		}),
	);
}

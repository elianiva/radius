import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import { session, project, sessionSummary } from "~/db/schema";
import { eq, sql } from "drizzle-orm";

export class SessionsError extends Data.TaggedError("SessionsError")<{
	readonly cause: unknown;
	readonly message: string;
}> {}

interface SessionsServiceShape {
	readonly list: (params: {
		search?: string;
		sortBy?: string;
		sortDir?: "asc" | "desc";
		cursor?: string;
	}) => Effect.Effect<PaginatedSessions, SessionsError>;
}

export interface ExtendedSession {
	id: string;
	projectName: string;
	title: string | null;
	duration: number;
	totalCost: number;
	totalTokens: number;
	models: string[];
	messageCount: number;
	toolCallCount: number;
	toolErrorCount: number;
	createdAt: number;
}

export interface PaginatedSessions {
	items: ExtendedSession[];
	nextCursor: string | null;
	totalPages: number;
	currentPage: number;
}

const PAGE_SIZE = 15;

export class SessionsService extends Context.Service<SessionsService, SessionsServiceShape>()(
	"radius/SessionsService",
) {
	static readonly layer = Layer.effect(
		SessionsService,
		Effect.gen(function* () {
			const db = yield* Database;

			const list = Effect.fn("listSessions")(function* (params: {
				search?: string;
				sortBy?: string;
				sortDir?: "asc" | "desc";
				cursor?: string;
			}) {
				// Determine sort column and direction from session_summary
				const sortCol =
					params.sortBy === "duration"
						? sessionSummary.duration
						: params.sortBy === "totalCost"
							? sessionSummary.totalCost
							: params.sortBy === "totalTokens"
								? sessionSummary.totalTokens
								: params.sortBy === "messageCount"
									? sessionSummary.messageCount
									: params.sortBy === "toolErrorCount"
										? sessionSummary.toolErrorCount
										: sessionSummary.createdAt;

				const dir = params.sortDir === "asc" ? sql`asc` : sql`desc`;

				const rows = yield* Effect.try({
					try: () => {
						const q = db
							.select({
								id: sessionSummary.id,
								projectId: sessionSummary.projectId,
								createdAt: sessionSummary.createdAt,
								duration: sessionSummary.duration,
								messageCount: sessionSummary.messageCount,
								totalCost: sessionSummary.totalCost,
								totalTokens: sessionSummary.totalTokens,
								models: sessionSummary.models,
								toolCallCount: sessionSummary.toolCallCount,
								toolErrorCount: sessionSummary.toolErrorCount,
								title: session.title,
								projectName: project.name,
							})
							.from(sessionSummary)
							.leftJoin(session, eq(sessionSummary.id, session.id))
							.leftJoin(project, eq(sessionSummary.projectId, project.id))
							.orderBy(sql`${sortCol} ${dir}`)
							.limit(PAGE_SIZE + 1);

						if (params.cursor) {
							q.where(sql`${sessionSummary.id} < ${params.cursor}`);
						}

						return q.all();
					},
					catch: (cause) => new SessionsError({ cause, message: "Failed to list sessions" }),
				});

				const hasMore = rows.length > PAGE_SIZE;
				const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
				const nextCursor = hasMore ? items[items.length - 1].id : null;

				return {
					items: items.map((r) => ({
						id: r.id,
						projectName: r.projectName ?? r.projectId,
						title: r.title,
						duration: r.duration,
						totalCost: r.totalCost,
						totalTokens: r.totalTokens,
						models: JSON.parse(r.models) as string[],
						messageCount: r.messageCount,
						toolCallCount: r.toolCallCount,
						toolErrorCount: r.toolErrorCount,
						createdAt: r.createdAt,
					})),
					nextCursor,
					totalPages: 0,
					currentPage: 0,
				};
			});

			return SessionsService.of({ list });
		}),
	);
}

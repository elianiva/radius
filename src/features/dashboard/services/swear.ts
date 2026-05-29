import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import { swearEntry } from "~/db/schema";
import { sql } from "drizzle-orm";
import type { SwearMention, SwearSummary } from "./swear-types";
import type { DashboardFilters } from "./filters";

export interface SwearEntryData {
	sessionId: string;
	projectName: string;
	sessionTitle: string | null;
	word: string;
	context: string;
	createdAt: number;
}

export class SwearError extends Data.TaggedError("SwearError")<{
	readonly cause: unknown;
	readonly message: string;
}> {}

interface SwearServiceShape {
	readonly getSummary: (filters?: DashboardFilters) => Effect.Effect<SwearSummary, SwearError>;
}

export class SwearService extends Context.Service<SwearService, SwearServiceShape>()(
	"radius/SwearService",
) {
	static readonly layer = Layer.effect(
		SwearService,
		Effect.gen(function* () {
			const db = yield* Database;

			const getSummary = Effect.fn("getSwearMetrics")(function* (filters?: DashboardFilters) {
				const conditions: ReturnType<typeof sql>[] = [];
				if (filters?.dateFrom != null) {
					conditions.push(sql`${swearEntry.createdAt} >= ${filters.dateFrom}`);
				}
				if (filters?.dateTo != null) {
					conditions.push(sql`${swearEntry.createdAt} < ${filters.dateTo}`);
				}
				if (filters?.projectIds?.length) {
					conditions.push(sql`${swearEntry.projectName} IN (${sql.join(filters.projectIds.map((id) => sql`${id}`), sql`,`)})`);
				}

				const countRows = yield* Effect.try({
					try: () => {
						const q = db
							.select({
								totalMentions: sql<number>`count(*)`,
								uniqueSessions: sql<number>`count(distinct ${swearEntry.sessionId})`,
								uniqueProjects: sql<number>`count(distinct ${swearEntry.projectName})`,
							})
							.from(swearEntry);
						for (const c of conditions) q.where(c);
						return q.all();
					},
					catch: (cause) => new SwearError({ cause, message: "Failed to count swear entries" }),
				});
				const counts = countRows[0]!;

				const allWordRows = yield* Effect.try({
					try: () => {
						const q = db
							.select({
								word: swearEntry.word,
								count: sql<number>`count(*)`,
							})
							.from(swearEntry)
							.groupBy(swearEntry.word)
							.orderBy(sql`count(*) desc`);
						for (const c of conditions) q.where(c);
						return q.all();
					},
					catch: (cause) =>
						new SwearError({ cause, message: "Failed to get all swear word frequencies" }),
				});
				const allWordFrequencies = allWordRows.map((r) => ({ word: r.word, count: r.count }));

				const wordRows = yield* Effect.try({
					try: () => {
						const q = db
							.select({
								word: swearEntry.word,
								count: sql<number>`count(*)`,
							})
							.from(swearEntry)
							.groupBy(swearEntry.word)
							.orderBy(sql`count(*) desc`)
							.limit(10);
						for (const c of conditions) q.where(c);
						return q.all();
					},
					catch: (cause) => new SwearError({ cause, message: "Failed to get top swear words" }),
				});
				const topWords = wordRows.map((r) => ({ word: r.word, count: r.count }));

				const trendRows = yield* Effect.try({
					try: () => {
						const q = db
							.select({
								date: sql<string>`date(${swearEntry.createdAt} / 1000, 'unixepoch')`,
								count: sql<number>`count(*)`,
							})
							.from(swearEntry)
							.groupBy(sql`date(${swearEntry.createdAt} / 1000, 'unixepoch')`)
							.orderBy(sql`date(${swearEntry.createdAt} / 1000, 'unixepoch')`);
						for (const c of conditions) q.where(c);
						return q.all();
					},
					catch: (cause) => new SwearError({ cause, message: "Failed to get swear trend" }),
				});
				const swearTrend = trendRows.map((r) => ({ date: r.date, count: r.count }));

				const projectRows = yield* Effect.try({
					try: () => {
						const q = db
							.select({
								project: swearEntry.projectName,
								count: sql<number>`count(*)`,
								sessions: sql<number>`count(distinct ${swearEntry.sessionId})`,
							})
							.from(swearEntry)
							.groupBy(swearEntry.projectName)
							.orderBy(sql`count(*) desc`);
						for (const c of conditions) q.where(c);
						return q.all();
					},
					catch: (cause) => new SwearError({ cause, message: "Failed to get swear by project" }),
				});
				const swearByProject = projectRows.map((r) => ({
					project: r.project,
					count: r.count,
					sessions: r.sessions,
				}));

				const sessionRows = yield* Effect.try({
					try: () => {
						const q = db
							.select({
								sessionId: swearEntry.sessionId,
								mentionCount: sql<number>`count(*)`,
							})
							.from(swearEntry)
							.groupBy(swearEntry.sessionId)
							.orderBy(sql`count(*) desc`)
							.limit(10);
						for (const c of conditions) q.where(c);
						return q.all();
					},
					catch: (cause) => new SwearError({ cause, message: "Failed to get top swear sessions" }),
				});

				const topSessionIds = sessionRows.map((r) => r.sessionId);
				let topSessions: SwearMention[] = [];

				if (topSessionIds.length > 0) {
					const mentionRows = yield* Effect.try({
						try: () => db.select().from(swearEntry).all(),
						catch: (cause) => new SwearError({ cause, message: "Failed to get swear entries" }),
					});

					const sessionMap = new Map<string, typeof mentionRows>();
					for (const r of mentionRows) {
						const existing = sessionMap.get(r.sessionId) ?? [];
						existing.push(r);
						sessionMap.set(r.sessionId, existing);
					}

					topSessions = topSessionIds
						.map((sid) => {
							const entries = sessionMap.get(sid) ?? [];
							const first = entries[0];
							return {
								word: first?.word ?? "",
								context: first?.context ?? "",
								projectName: first?.projectName ?? "",
								sessionTitle: first?.sessionTitle ?? null,
								sessionId: sid,
								createdAt: first?.createdAt ?? 0,
							};
						})
						.filter((s): s is SwearMention => s.word !== "");
				}

				return {
					totalMentions: counts.totalMentions,
					totalSessions: counts.uniqueSessions,
					uniqueProjects: counts.uniqueProjects,
					topWords,
					topSessions,
					swearTrend,
					swearByProject,
					allWordFrequencies,
				};
			});

			return SwearService.of({ getSummary });
		}),
	);
}

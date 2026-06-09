import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import { project, sessionEvent, sessionSummary } from "~/db/schema";
import { eq, sql } from "drizzle-orm";
import type { DashboardFilters } from "./filters";
import { applySummaryFilters, withFilters } from "./filters";

export class OverviewError extends Data.TaggedError("OverviewError")<{
	readonly cause: unknown;
	readonly message: string;
}> {}

export interface OverviewCards {
	totalSessions: number;
	totalCost: number;
	avgCostPerSession: number;
	totalTokens: number;
	errorRate: number;
	mostUsedModel: { name: string; count: number };
}

export interface CostOverTimeEntry {
	date: string;
	cost: number;
	sessions: number;
}

export interface ModelUsageEntry {
	model: string;
	count: number;
	cost: number;
}

export interface TopProjectEntry {
	name: string;
	sessionCount: number;
	cost: number;
}

export interface ThinkingLevelEntry {
	level: string;
	count: number;
}

export interface StopReasonEntry {
	reason: string;
	count: number;
}

export interface ProjectMetrics {
	id: string;
	name: string;
	sessionCount: number;
	totalCost: number;
	avgMessagesPerSession: number;
	avgDuration: number;
	errorRate: number;
	mostUsedModel: string;
}

export interface DashboardMetrics {
	totalSessions: number;
	totalCost: number;
	avgCostPerSession: number;
	totalTokens: number;
	errorRate: number;
	mostUsedModel: { name: string; count: number };
	costOverTime: CostOverTimeEntry[];
	modelUsage: ModelUsageEntry[];
	thinkingLevels: ThinkingLevelEntry[];
	stopReasons: StopReasonEntry[];
	projects: ProjectMetrics[];
	topProjects: TopProjectEntry[];
}

interface OverviewServiceShape {
	readonly getCards: (filters?: DashboardFilters) => Effect.Effect<OverviewCards, OverviewError>;
	readonly getCostOverTime: (
		filters?: DashboardFilters,
	) => Effect.Effect<CostOverTimeEntry[], OverviewError>;
	readonly getModelUsage: (
		filters?: DashboardFilters,
	) => Effect.Effect<ModelUsageEntry[], OverviewError>;
	readonly getTopProjects: (
		filters?: DashboardFilters,
	) => Effect.Effect<TopProjectEntry[], OverviewError>;
	readonly getThinkingLevels: (
		filters?: DashboardFilters,
	) => Effect.Effect<ThinkingLevelEntry[], OverviewError>;
	readonly getStopReasons: (
		filters?: DashboardFilters,
	) => Effect.Effect<StopReasonEntry[], OverviewError>;
	readonly getDashboardMetrics: (
		filters?: DashboardFilters,
	) => Effect.Effect<DashboardMetrics, OverviewError>;
}

export class OverviewService extends Context.Service<OverviewService, OverviewServiceShape>()(
	"radius/OverviewService",
) {
	static readonly layer = Layer.effect(
		OverviewService,
		Effect.gen(function* () {
			const db = yield* Database;

			const getCards = Effect.fn("getOverviewCards")(function* (filters?: DashboardFilters) {
				const conditions = applySummaryFilters(filters);

				const rows = yield* Effect.try({
					try: () =>
						withFilters(
							db
								.select({
									totalSessions: sql<number>`count(*)`,
									totalCost: sql<number>`coalesce(sum(${sessionSummary.totalCost}), 0)`,
									totalTokens: sql<number>`coalesce(sum(${sessionSummary.totalTokens}), 0)`,
									errorSessions: sql<number>`coalesce(sum(case when ${sessionSummary.toolErrorCount} > 0 then 1 else 0 end), 0)`,
								})
								.from(sessionSummary),
							conditions,
						).all(),
					catch: (cause) => new OverviewError({ cause, message: "Failed to get overview cards" }),
				});

				const row = rows[0]!;

				const allModels = yield* Effect.try({
					try: () =>
						withFilters(
							db.select({ models: sessionSummary.models }).from(sessionSummary),
							conditions,
						).all(),
					catch: (cause) => new OverviewError({ cause, message: "Failed to get model data" }),
				});

				const globalModelCounts = new Map<string, number>();
				for (const r of allModels) {
					const models = JSON.parse(r.models) as string[];
					for (const m of models) globalModelCounts.set(m, (globalModelCounts.get(m) ?? 0) + 1);
				}
				const mostUsedModelEntry = Array.from(globalModelCounts.entries()).sort(
					(a, b) => b[1] - a[1],
				)[0];

				return {
					totalSessions: row.totalSessions,
					totalCost: row.totalCost,
					avgCostPerSession: row.totalSessions > 0 ? row.totalCost / row.totalSessions : 0,
					totalTokens: row.totalTokens,
					errorRate: row.totalSessions > 0 ? row.errorSessions / row.totalSessions : 0,
					mostUsedModel: mostUsedModelEntry
						? { name: mostUsedModelEntry[0], count: mostUsedModelEntry[1] }
						: { name: "—", count: 0 },
				};
			});

			const getCostOverTime = Effect.fn("getCostOverTime")(function* (filters?: DashboardFilters) {
				const conditions = applySummaryFilters(filters);
				const rows = yield* Effect.try({
					try: () =>
						withFilters(
							db
								.select({
									date: sql<string>`date(${sessionSummary.createdAt} / 1000, 'unixepoch')`,
									cost: sql<number>`coalesce(sum(${sessionSummary.totalCost}), 0)`,
									sessions: sql<number>`count(*)`,
								})
								.from(sessionSummary)
								.groupBy(sql`date(${sessionSummary.createdAt} / 1000, 'unixepoch')`)
								.orderBy(sql`date(${sessionSummary.createdAt} / 1000, 'unixepoch')`),
							conditions,
						).all(),
					catch: (cause) => new OverviewError({ cause, message: "Failed to get cost over time" }),
				});

				return rows.map((r) => ({ date: r.date, cost: r.cost, sessions: r.sessions }));
			});

			const getModelUsage = Effect.fn("getModelUsage")(function* (filters?: DashboardFilters) {
				const conditions = applySummaryFilters(filters);
				const rows = yield* Effect.try({
					try: () =>
						withFilters(
							db
								.select({ models: sessionSummary.models, totalCost: sessionSummary.totalCost })
								.from(sessionSummary),
							conditions,
						).all(),
					catch: (cause) => new OverviewError({ cause, message: "Failed to get model usage" }),
				});

				const modelCountMap = new Map<string, { count: number; cost: number }>();
				for (const r of rows) {
					const models = JSON.parse(r.models) as string[];
					for (const m of models) {
						const existing = modelCountMap.get(m) ?? { count: 0, cost: 0 };
						existing.count += 1;
						existing.cost += r.totalCost;
						modelCountMap.set(m, existing);
					}
				}
				return Array.from(modelCountMap.entries())
					.map(([model, data]) => ({ model, ...data }))
					.sort((a, b) => b.count - a.count);
			});

			const getTopProjects = Effect.fn("getTopProjects")(function* (filters?: DashboardFilters) {
				const conditions = applySummaryFilters(filters);
				const projectRows = yield* Effect.try({
					try: () => db.select({ id: project.id, name: project.name }).from(project).all(),
					catch: (cause) => new OverviewError({ cause, message: "Failed to get projects" }),
				});
				const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name ?? "Unknown"]));

				const rows = yield* Effect.try({
					try: () =>
						withFilters(
							db
								.select({
									projectId: sessionSummary.projectId,
									sessionCount: sql<number>`count(*)`,
									cost: sql<number>`coalesce(sum(${sessionSummary.totalCost}), 0)`,
								})
								.from(sessionSummary)
								.groupBy(sessionSummary.projectId)
								.orderBy(sql`count(*) desc`)
								.limit(5),
							conditions,
						).all(),
					catch: (cause) => new OverviewError({ cause, message: "Failed to get top projects" }),
				});

				return rows.map((r) => ({
					name: projectNameMap.get(r.projectId) ?? "Unknown",
					sessionCount: r.sessionCount,
					cost: r.cost,
				}));
			});

			const getThinkingLevels = Effect.fn("getThinkingLevels")(function* (
				filters?: DashboardFilters,
			) {
				const thinkingRows = yield* Effect.try({
					try: () => {
						let q = db
							.select()
							.from(sessionEvent)
							.where(eq(sessionEvent.eventType, "thinking_change")) as any;
						if (filters?.dateFrom != null)
							q = q.where(sql`${sessionEvent.createdAt} >= ${filters.dateFrom}`);
						if (filters?.dateTo != null)
							q = q.where(sql`${sessionEvent.createdAt} < ${filters.dateTo}`);
						return q.all();
					},
					catch: (cause) =>
						new OverviewError({ cause, message: "Failed to get thinking level events" }),
				});

				const thinkingLevelCounts = new Map<string, number>();
				for (const row of thinkingRows) {
					let parsed: Record<string, unknown>;
					try {
						parsed = JSON.parse(row.data);
					} catch {
						parsed = {};
					}
					const level = (parsed.thinkingLevel ?? parsed.level ?? "off") as string;
					thinkingLevelCounts.set(level, (thinkingLevelCounts.get(level) ?? 0) + 1);
				}
				return Array.from(thinkingLevelCounts.entries())
					.map(([level, count]) => ({ level, count }))
					.sort((a, b) => b.count - a.count);
			});

			const getStopReasons = Effect.fn("getStopReasons")(function* (filters?: DashboardFilters) {
				const conditions = applySummaryFilters(filters);
				const rows = yield* Effect.try({
					try: () =>
						withFilters(
							db.select({ stopReasons: sessionSummary.stopReasons }).from(sessionSummary),
							conditions,
						).all(),
					catch: (cause) => new OverviewError({ cause, message: "Failed to get stop reasons" }),
				});

				const stopReasonCounts = new Map<string, number>();
				for (const r of rows) {
					const reasons = JSON.parse(r.stopReasons) as Record<string, number>;
					for (const [reason, count] of Object.entries(reasons))
						stopReasonCounts.set(reason, (stopReasonCounts.get(reason) ?? 0) + count);
				}
				return Array.from(stopReasonCounts.entries())
					.map(([reason, count]) => ({ reason, count }))
					.sort((a, b) => b.count - a.count);
			});

			const getDashboardMetrics = Effect.fn("getDashboardMetrics")(function* (
				filters?: DashboardFilters,
			) {
				const [cards, costOverTime, modelUsage, thinkingLevels, stopReasons] = yield* Effect.all(
					[
						getCards(filters),
						getCostOverTime(filters),
						getModelUsage(filters),
						getThinkingLevels(filters),
						getStopReasons(filters),
					],
					{ concurrency: 3 },
				);

				const conditions = applySummaryFilters(filters);

				const projects = yield* Effect.gen(function* () {
					const projectRows = yield* Effect.try({
						try: () => db.select({ id: project.id, name: project.name }).from(project).all(),
						catch: (cause) => new OverviewError({ cause, message: "Failed to get projects" }),
					});
					const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name ?? "Unknown"]));

					const rows = yield* Effect.try({
						try: () =>
							withFilters(
								db
									.select({
										projectId: sessionSummary.projectId,
										sessionCount: sql<number>`count(*)`,
										totalCost: sql<number>`coalesce(sum(${sessionSummary.totalCost}), 0)`,
										totalMessages: sql<number>`coalesce(sum(${sessionSummary.messageCount}), 0)`,
										totalDuration: sql<number>`coalesce(sum(${sessionSummary.duration}), 0)`,
										errorSessions: sql<number>`coalesce(sum(case when ${sessionSummary.toolErrorCount} > 0 then 1 else 0 end), 0)`,
									})
									.from(sessionSummary)
									.groupBy(sessionSummary.projectId),
								conditions,
							).all(),
						catch: (cause) =>
							new OverviewError({ cause, message: "Failed to get project metrics" }),
					});

					const modelRows = yield* Effect.try({
						try: () =>
							withFilters(
								db
									.select({ projectId: sessionSummary.projectId, models: sessionSummary.models })
									.from(sessionSummary),
								conditions,
							).all(),
						catch: (cause) =>
							new OverviewError({ cause, message: "Failed to get project model data" }),
					});

					const projectModelCounts = new Map<string, Map<string, number>>();
					for (const r of modelRows) {
						let modelMap = projectModelCounts.get(r.projectId);
						if (!modelMap) {
							modelMap = new Map();
							projectModelCounts.set(r.projectId, modelMap);
						}
						const models = JSON.parse(r.models) as string[];
						for (const m of models) modelMap.set(m, (modelMap.get(m) ?? 0) + 1);
					}

					return rows.map((r) => {
						const modelCounts = projectModelCounts.get(r.projectId);
						const mostUsedModel = modelCounts
							? (Array.from(modelCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—")
							: "—";
						return {
							id: r.projectId,
							name: projectNameMap.get(r.projectId) ?? "Unknown",
							sessionCount: r.sessionCount,
							totalCost: r.totalCost,
							avgMessagesPerSession: r.sessionCount > 0 ? r.totalMessages / r.sessionCount : 0,
							avgDuration: r.sessionCount > 0 ? r.totalDuration / r.sessionCount : 0,
							errorRate: r.sessionCount > 0 ? r.errorSessions / r.sessionCount : 0,
							mostUsedModel,
						};
					});
				});

				const topProjects = projects
					.sort((a, b) => b.sessionCount - a.sessionCount)
					.slice(0, 5)
					.map((p) => ({ name: p.name, sessionCount: p.sessionCount, cost: p.totalCost }));

				return {
					...cards,
					costOverTime,
					modelUsage,
					thinkingLevels,
					stopReasons,
					projects,
					topProjects,
				};
			});

			return OverviewService.of({
				getCards,
				getCostOverTime,
				getModelUsage,
				getTopProjects,
				getThinkingLevels,
				getStopReasons,
				getDashboardMetrics,
			});
		}),
	);
}

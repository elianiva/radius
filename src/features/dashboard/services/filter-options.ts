import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import { project, sessionSummary } from "~/db/schema";

export class FilterOptionsError extends Data.TaggedError("FilterOptionsError")<{
	readonly cause: unknown;
	readonly message: string;
}> {}

interface FilterOptionsServiceShape {
	readonly getProjectNames: () => Effect.Effect<{ id: string; name: string }[], FilterOptionsError>;
	readonly getModelNames: () => Effect.Effect<string[], FilterOptionsError>;
}

export class FilterOptionsService extends Context.Service<
	FilterOptionsService,
	FilterOptionsServiceShape
>()("radius/FilterOptionsService") {
	static readonly layer = Layer.effect(
		FilterOptionsService,
		Effect.gen(function* () {
			const db = yield* Database;

			const getProjectNames = Effect.fn("getProjectNames")(function* () {
				const rows = yield* Effect.try({
					try: () => db.select({ id: project.id, name: project.name }).from(project).all(),
					catch: (cause) =>
						new FilterOptionsError({ cause, message: "Failed to get project names" }),
				});

				return rows.map((r) => ({ id: r.id, name: r.name ?? "Unknown" }));
			});

			const getModelNames = Effect.fn("getModelNames")(function* () {
				const rows = yield* Effect.try({
					try: () => db.select({ models: sessionSummary.models }).from(sessionSummary).all(),
					catch: (cause) => new FilterOptionsError({ cause, message: "Failed to get model names" }),
				});

				const modelSet = new Set<string>();
				for (const r of rows) {
					const parsed = JSON.parse(r.models) as string[];
					for (const m of parsed) {
						modelSet.add(m);
					}
				}

				return Array.from(modelSet).sort();
			});

			return FilterOptionsService.of({ getProjectNames, getModelNames });
		}),
	);
}

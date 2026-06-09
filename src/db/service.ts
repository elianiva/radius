import { Context, Effect, FileSystem, Layer, Path } from "effect";
import { DatabaseSync } from "node:sqlite";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { fileURLToPath } from "node:url";
import { resolveDbDir } from "~/lib/db";
import * as schema from "./schema";

export type DatabaseShape = NodeSQLiteDatabase<typeof schema> & { $client: DatabaseSync };

export class Database extends Context.Service<Database, DatabaseShape>()("radius/SessionDatabase") {
	static readonly layer = Layer.effect(
		Database,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const dbDir = yield* resolveDbDir;
			const migrationsDir = import.meta.env.DEV
				? fileURLToPath(new URL("./migrations", import.meta.url))
				: fileURLToPath(new URL("../../db/migrations", import.meta.url));

			yield* fs.makeDirectory(dbDir, { recursive: true });

			const dbPath = path.join(dbDir, "sessions.db");
			const sqlite = new DatabaseSync(dbPath);
			yield* Effect.addFinalizer(() => Effect.sync(() => sqlite.close()));

			sqlite.exec("PRAGMA journal_mode = WAL");
			sqlite.exec("PRAGMA foreign_keys = ON");

			yield* Effect.try({
				try: () => {
					migrate(drizzle({ client: sqlite }), { migrationsFolder: migrationsDir });
				},
				catch: (cause) => cause,
			});

			return drizzle({ client: sqlite, schema });
		}),
	);
}

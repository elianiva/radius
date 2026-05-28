import { Config, Context, Effect, FileSystem, Layer, Path } from "effect";
import { DatabaseSync } from "node:sqlite";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import * as schema from "./schema";

export type DatabaseShape = NodeSQLiteDatabase<typeof schema> & { $client: DatabaseSync };

export class Database extends Context.Service<Database, DatabaseShape>()("radius/SessionDatabase") {
  static migrate(db: NodeSQLiteDatabase<typeof schema>) {
    migrate(db, { migrationsFolder: "./src/db/migrations" });
  }

  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* Config.string("HOME");
      const dbPath = path.join(home, ".local/share/radius/sessions.db");

      yield* fs.makeDirectory(path.dirname(dbPath), { recursive: true });

      const sqlite = new DatabaseSync(dbPath);
      yield* Effect.addFinalizer(() => Effect.sync(() => sqlite.close()));

      sqlite.exec("PRAGMA journal_mode = WAL");
      sqlite.exec("PRAGMA foreign_keys = ON");

      return drizzle({ client: sqlite, schema });
    }),
  );
}

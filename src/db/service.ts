import { Context, Effect, FileSystem, Layer } from "effect";
import { DatabaseSync } from "node:sqlite";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import * as schema from "./schema";

export type DatabaseShape = NodeSQLiteDatabase<typeof schema> & { $client: DatabaseSync };

const resolveDbDir = Effect.gen(function* () {
  const envDir = yield* Effect.sync(() => process.env.RADIUS_DB_DIR);
  if (envDir) return envDir;

  const home = yield* Effect.sync(() => homedir());
  const plat = yield* Effect.sync(() => platform());

  if (plat === "darwin") {
    return join(home, "Library", "Application Support", "radius");
  }

  if (plat === "win32") {
    const appData = yield* Effect.sync(() => process.env.APPDATA);
    const base = appData || join(home, "AppData", "Roaming");
    return join(base, "radius");
  }

  const xdgData = yield* Effect.sync(() => process.env.XDG_DATA_HOME);
  if (xdgData && xdgData.length > 0) {
    return join(xdgData, "radius");
  }
  return join(home, ".local", "share", "radius");
});

// Migration path differs depending on whether we're in source (vp dev) or
// bundled (production) — probe both and use whichever exists.
const resolveMigrationsDir = Effect.gen(function* () {
  const fromSource = fileURLToPath(new URL("../migrations", import.meta.url));
  const fromBundle = fileURLToPath(new URL("../../db/migrations", import.meta.url));
  const exists = yield* Effect.sync(() => existsSync(fromSource));
  return exists ? fromSource : fromBundle;
});

export class Database extends Context.Service<Database, DatabaseShape>()("radius/SessionDatabase") {
  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const dbDir = yield* resolveDbDir;
      const migrationsDir = yield* resolveMigrationsDir;

      yield* fs.makeDirectory(dbDir, { recursive: true });

      const dbPath = join(dbDir, "sessions.db");
      const sqlite = new DatabaseSync(dbPath);
      yield* Effect.addFinalizer(() => Effect.sync(() => sqlite.close()));

      sqlite.exec("PRAGMA journal_mode = WAL");
      sqlite.exec("PRAGMA foreign_keys = ON");

      yield* Effect.try(() => {
        migrate(drizzle({ client: sqlite }), { migrationsFolder: migrationsDir });
      });

      return drizzle({ client: sqlite, schema });
    }),
  );
}

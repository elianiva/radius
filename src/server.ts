import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

const dbDir = join(homedir(), ".local/share/radius");
const dbPath = join(dbDir, "sessions.db");

mkdirSync(dbDir, { recursive: true });

const sqlite = new DatabaseSync(dbPath);
try {
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA foreign_keys = ON");
  migrate(drizzle({ client: sqlite }), { migrationsFolder: "./src/db/migrations" });
} finally {
  sqlite.close();
}

const handler = createStartHandler(defaultStreamHandler);

export default {
  fetch: handler,
};

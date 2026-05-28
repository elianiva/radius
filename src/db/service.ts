import { Context, Data, Effect, Layer } from "effect";
import { FileSystem } from "@effect/platform/FileSystem";
import { Path } from "@effect/platform/Path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { eq, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import * as schema from "./schema.ts";

export type Project = InferSelectModel<typeof schema.project>;
export type Session = InferSelectModel<typeof schema.session>;
export type Event = InferSelectModel<typeof schema.event>;
export type SessionEvent = InferSelectModel<typeof schema.sessionEvent>;

export interface SessionFilter {
  readonly projectId?: string;
}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> { }

export class SessionDatabase extends Context.Service<SessionDatabase>()("radius/SessionDatabase", {
  make: (dbPath: string) =>
    Effect.gen(function*() {
      const fs = yield* FileSystem;
      const path = yield* Path;

      yield* fs.makeDirectory(path.dirname(dbPath), { recursive: true });

      const sqlite = new DatabaseSync(dbPath);
      yield* Effect.addFinalizer(() => Effect.sync(() => sqlite.close()));

      sqlite.exec("PRAGMA journal_mode = WAL");
      sqlite.exec("PRAGMA foreign_keys = ON");

      const db = drizzle({ client: sqlite, schema });
      migrate(db, { migrationsFolder: "./src/db/migrations" });

      const getProjects = Effect.try({
        try: () => db.select().from(schema.project).all(),
        catch: (cause) => new DatabaseError({ cause }),
      });

      const getSessions = (filter?: SessionFilter) =>
        Effect.try({
          try: () => {
            const q = db.select().from(schema.session).$dynamic();
            if (filter?.projectId) {
              q.where(eq(schema.session.projectId, filter.projectId));
            }
            return q.all();
          },
          catch: (cause) => new DatabaseError({ cause }),
        });

      const getEvents = (sessionId: string) =>
        Effect.try({
          try: () =>
            db.select().from(schema.event).where(eq(schema.event.sessionId, sessionId)).all(),
          catch: (cause) => new DatabaseError({ cause }),
        });

      const getModelUsage = Effect.try({
        try: () =>
          db.all<{ model: string; count: number }>(
            sql`
                SELECT json_extract(data, '$.model') as model, COUNT(*) as count
                FROM event
                WHERE event_type = 'message' AND json_extract(data, '$.role') = 'assistant'
                GROUP BY model ORDER BY count DESC
              `,
          ),
        catch: (cause) => new DatabaseError({ cause }),
      });

      const getToolUsage = Effect.try({
        try: () =>
          db.all<{ tool: string; count: number }>(
            sql`
                SELECT json_extract(part.value, '$.name') as tool, COUNT(*) as count
                FROM event, json_each(json_extract(data, '$.content')) as part
                WHERE event_type = 'message'
                  AND json_extract(data, '$.role') = 'assistant'
                  AND json_extract(part.value, '$.type') = 'toolCall'
                GROUP BY tool ORDER BY count DESC
              `,
          ),
        catch: (cause) => new DatabaseError({ cause }),
      });

      return {
        migrate: Effect.try({
          try: () => migrate(db, { migrationsFolder: "./src/db/migrations" }),
          catch: (cause) => new DatabaseError({ cause }),
        }),
        ingestPi: Effect.die("not implemented"),
        ingestOpencode: Effect.die("not implemented"),
        ingestAll: Effect.die("not implemented"),
        getProjects,
        getSessions,
        getEvents,
        getModelUsage,
        getToolUsage,
      } as const;
    }),
}) {
  static readonly layer = (dbPath: string) => Layer.effect(this, this.make(dbPath));
}

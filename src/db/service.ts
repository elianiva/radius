import { Context, Effect } from "effect"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { eq, sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import * as schema from "./schema.ts"

export type Project = InferSelectModel<typeof schema.project>
export type Session = InferSelectModel<typeof schema.session>
export type Event = InferSelectModel<typeof schema.event>
export type SessionEvent = InferSelectModel<typeof schema.sessionEvent>

export interface SessionFilter {
  readonly projectId?: string
}

export interface SessionDb {
  readonly migrate: Effect.Effect<void>
  readonly ingestPi: Effect.Effect<void>
  readonly ingestOpencode: Effect.Effect<void>
  readonly ingestAll: Effect.Effect<void>
  readonly getProjects: Effect.Effect<Project[]>
  readonly getSessions: (filter?: SessionFilter) => Effect.Effect<Session[]>
  readonly getEvents: (sessionId: string) => Effect.Effect<Event[]>
  readonly getModelUsage: Effect.Effect<Array<{ model: string; count: number }>>
  readonly getToolUsage: Effect.Effect<Array<{ tool: string; count: number }>>
}

export const SessionDb = Context.Service<SessionDb>("radius/SessionDb")

type Db = BetterSQLite3Database<typeof schema>

export const make = (db: Db): SessionDb => ({
  migrate: Effect.sync(() =>
    migrate(db, { migrationsFolder: "./src/db/migrations" })
  ),

  ingestPi: Effect.die("not implemented"),
  ingestOpencode: Effect.die("not implemented"),
  ingestAll: Effect.die("not implemented"),

  getProjects: Effect.sync(() =>
    db.select().from(schema.project).all()
  ),

  getSessions: (filter) =>
    Effect.sync(() => {
      const q = db.select().from(schema.session).$dynamic()
      if (filter?.projectId) {
        q.where(eq(schema.session.projectId, filter.projectId))
      }
      return q.all()
    }),

  getEvents: (sessionId) =>
    Effect.sync(() =>
      db.select().from(schema.event)
        .where(eq(schema.event.sessionId, sessionId))
        .all()
    ),

  getModelUsage: Effect.sync(() =>
    db.all<{ model: string; count: number }>(
      sql`
        SELECT json_extract(data, '$.model') as model, COUNT(*) as count
        FROM event
        WHERE event_type = 'message' AND json_extract(data, '$.role') = 'assistant'
        GROUP BY model ORDER BY count DESC
      `
    )
  ),

  getToolUsage: Effect.sync(() =>
    db.all<{ tool: string; count: number }>(
      sql`
        SELECT json_extract(part.value, '$.name') as tool, COUNT(*) as count
        FROM event, json_each(json_extract(data, '$.content')) as part
        WHERE event_type = 'message'
          AND json_extract(data, '$.role') = 'assistant'
          AND json_extract(part.value, '$.type') = 'toolCall'
        GROUP BY tool ORDER BY count DESC
      `
    )
  ),
})

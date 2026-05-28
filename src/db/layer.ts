import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { Effect, Layer } from "effect"
import { FileSystem } from "@effect/platform/FileSystem"
import { Path } from "@effect/platform/Path"
import * as schema from "./schema.ts"
import { SessionDb, make } from "./service.ts"

export const layer = (dbPath: string) =>
  Layer.effect(SessionDb)(
    Effect.gen(function*() {
      const fs = yield* FileSystem
      const path = yield* Path
      yield* fs.makeDirectory(path.dirname(dbPath), { recursive: true })
      const sqlite = new Database(dbPath)
      yield* Effect.addFinalizer(() => Effect.sync(() => sqlite.close()))
      sqlite.pragma("journal_mode = WAL")
      sqlite.pragma("foreign_keys = ON")
      const db = drizzle(sqlite, { schema })
      migrate(db, { migrationsFolder: "./src/db/migrations" })
      return make(db)
    })
  )

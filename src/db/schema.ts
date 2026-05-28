import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const project = sqliteTable("project", {
  id: text("id").primaryKey(),
  name: text("name"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export type Project = typeof project.$inferSelect;

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    parentSessionId: text("parent_session_id"),
    title: text("title"),
    directory: text("directory").notNull(),
    agent: text("agent"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    archivedAt: integer("archived_at"),
  },
  (table) => [index("idx_session_project_id").on(table.projectId)],
);
export type Session = typeof session.$inferSelect;

export const event = sqliteTable(
  "event",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.id),
    parentId: text("parent_id"),
    seq: integer("seq"),
    eventType: text("event_type").notNull(),
    createdAt: integer("created_at").notNull(),
    data: text("data").notNull(),
  },
  (table) => [index("idx_event_session_id").on(table.sessionId)],
);
export type Event = typeof event.$inferSelect;

export const sessionEvent = sqliteTable(
  "session_event",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.id),
    eventType: text("event_type").notNull(),
    createdAt: integer("created_at").notNull(),
    data: text("data").notNull(),
  },
  (table) => [
    index("idx_session_event_session_id").on(table.sessionId),
    index("idx_session_event_event_type").on(table.eventType),
  ],
);
export type SessionEvent = typeof sessionEvent.$inferSelect;

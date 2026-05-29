import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

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

export const sessionSummary = sqliteTable("session_summary", {
	id: text("id")
		.primaryKey()
		.references(() => session.id),
	projectId: text("project_id").notNull(),
	createdAt: integer("created_at").notNull(),
	duration: integer("duration").notNull(),
	messageCount: integer("message_count").notNull(),
	userMsgCount: integer("user_msg_count").notNull(),
	asstMsgCount: integer("asst_msg_count").notNull(),
	toolCallCount: integer("tool_call_count").notNull(),
	toolErrorCount: integer("tool_error_count").notNull(),
	totalTokens: integer("total_tokens").notNull(),
	totalCost: real("total_cost").notNull(),
	models: text("models").notNull(),
	stopReasons: text("stop_reasons").notNull(),
});
export type SessionSummary = typeof sessionSummary.$inferSelect;
export type NewSessionSummary = typeof sessionSummary.$inferInsert;

export const swearEntry = sqliteTable(
	"swear_entry",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		sessionId: text("session_id")
			.notNull()
			.references(() => session.id),
		projectName: text("project_name").notNull(),
		sessionTitle: text("session_title"),
		word: text("word").notNull(),
		context: text("context").notNull(),
		createdAt: integer("created_at").notNull(),
	},
	(table) => ({
		sessionIdx: index("idx_swear_entry_session_id").on(table.sessionId),
		wordIdx: index("idx_swear_entry_word").on(table.word),
		projectIdx: index("idx_swear_entry_project").on(table.projectName),
	}),
);
export type SwearEntry = typeof swearEntry.$inferSelect;
export type NewSwearEntry = typeof swearEntry.$inferInsert;

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

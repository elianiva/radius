import { Context, Data, Effect, Layer } from "effect";

import { Database } from "~/db/service";
import { session } from "~/db/schema";
import { SQL, and, desc, eq, isNull, isNotNull, lt } from "drizzle-orm";
import { event, sessionEvent } from "~/db/schema";
import type { Session } from "~/db/schema";

export interface TimelineEvent {
  readonly id: string;
  readonly sessionId: string;
  readonly eventType: string;
  readonly createdAt: number;
  readonly data: string;
}

export class SessionError extends Data.TaggedError("SessionError")<{
  readonly cause: unknown;
  readonly message: string;
}> {}

const MAX_PAGE_SIZE = 100;

export interface Paginated<S> {
  readonly items: S[];
  readonly cursor: string | null;
}

interface SessionServiceShape {
  readonly list: (params: {
    readonly cursor?: string;
    readonly limit?: number;
    readonly agent?: string;
    readonly archived?: boolean;
  }) => Effect.Effect<Paginated<Session>, SessionError>;

  readonly getEvents: (params: {
    readonly sessionId: string;
  }) => Effect.Effect<readonly TimelineEvent[], SessionError>;
}

export class SessionService extends Context.Service<SessionService, SessionServiceShape>()(
  "radius/SessionService",
) {
  static readonly layer = Layer.effect(
    SessionService,
    Effect.gen(function* () {
      const db = yield* Database;

      const getEvents = Effect.fn("getEvents")(function* (params: { readonly sessionId: string }) {
        const [eventRows, sessionEventRows] = yield* Effect.try({
          try: () => [
            db.select().from(event).where(eq(event.sessionId, params.sessionId)).all(),
            db
              .select()
              .from(sessionEvent)
              .where(eq(sessionEvent.sessionId, params.sessionId))
              .all(),
          ],
          catch: (cause) => new SessionError({ cause, message: "Failed to get events" }),
        });

        const normalized: TimelineEvent[] = [
          ...eventRows.map((r) => ({
            id: r.id,
            sessionId: r.sessionId,
            eventType: r.eventType,
            createdAt: r.createdAt,
            data: r.data,
          })),
          ...sessionEventRows.map((r) => ({
            id: r.id,
            sessionId: r.sessionId,
            eventType: r.eventType,
            createdAt: r.createdAt,
            data: r.data,
          })),
        ];

        normalized.sort((a, b) => a.createdAt - b.createdAt);

        return normalized;
      });

      const list = Effect.fn("list")(function* (params: {
        readonly cursor?: string;
        readonly limit?: number;
        readonly agent?: string;
        readonly archived?: boolean;
      }) {
        const limit = Math.min(params.limit ?? 50, MAX_PAGE_SIZE);
        const conditions: SQL[] = [];

        if (params.agent) conditions.push(eq(session.agent, params.agent));
        if (params.archived === true) {
          conditions.push(isNotNull(session.archivedAt));
        } else {
          conditions.push(isNull(session.archivedAt));
        }

        if (params.cursor) {
          conditions.push(lt(session.id, params.cursor));
        }

        yield* Effect.logInfo("Querying").pipe(
          Effect.annotateLogs({
            limit,
            cursor: params.cursor ?? null,
            agent: params.agent ?? null,
            archived: params.archived ?? false,
          }),
        );

        const rows = yield* Effect.try({
          try: () =>
            db
              .select()
              .from(session)
              .where(and(...conditions))
              .orderBy(desc(session.id))
              .limit(limit + 1)
              .all(),
          catch: (cause) => new SessionError({ cause, message: "Failed to list sessions" }),
        });

        yield* Effect.logInfo("Rows fetched").pipe(Effect.annotateLogs("count", rows.length));

        const hasMore = rows.length > limit;
        const items = hasMore ? rows.slice(0, limit) : rows;
        const cursor = hasMore ? items[items.length - 1].id : null;

        yield* Effect.logInfo("Done").pipe(
          Effect.annotateLogs({ returned: items.length, hasMore }),
        );

        return { items, cursor } as Paginated<Session>;
      });

      return SessionService.of({ list, getEvents });
    }),
  );
}

import { createServerFn } from "@tanstack/react-start";
import { Effect, Layer } from "effect";

import { AppRuntime } from "../../app-runtime";
import { Database } from "~/db/service";
import { session, project } from "~/db/schema";
import { SessionService } from "~/features/sessions/services/session";
import { PlatformLayer } from "../../app-layer";
import { computeSwearMetrics } from "./swear-words-service";

export const getSwearMetrics = createServerFn({ method: "GET" }).handler(() =>
  AppRuntime.runPromise(
    Effect.gen(function*() {
      const db = yield* Database;
      const svc = yield* SessionService;

      const sessionRows = db.select().from(session).all();
      const projectRows = db.select().from(project).all();
      const projectNameMap = new Map(projectRows.map((p) => [p.id, p.name]));

      const allMetrics = yield* Effect.all(
        sessionRows.map((sess) =>
          svc.computeSessionMetrics({
            session: sess,
            projectName: projectNameMap.get(sess.projectId) ?? "Unknown",
          }),
        ),
        { concurrency: 10 },
      );

      const result = yield* computeSwearMetrics(allMetrics, (sessionId: string) =>
        svc.getEvents({ sessionId }),
      );

      return result;
    }).pipe(Effect.orDie, Effect.provide(Database.layer.pipe(Layer.provide(PlatformLayer)))),
  ),
);

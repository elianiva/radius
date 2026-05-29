import { Context, Effect, Layer } from "effect";

import type { ParsedSession } from "../ingest/adapter";
import { SessionSummaryMatsService } from "./summary";
import { SwearMatsService, SwearMatError } from "./swear";
import type { SummaryError } from "./summary";

export class MaterialisationService extends Context.Service<
  MaterialisationService,
  {
    readonly materialiseSession: (
      parsed: ParsedSession,
    ) => Effect.Effect<void, SummaryError | SwearMatError>;
  }
>()("radius/MaterialisationService") {
  static readonly layer = Layer.effect(
    MaterialisationService,
    Effect.gen(function*() {
      const summaryMats = yield* SessionSummaryMatsService;
      const swearMats = yield* SwearMatsService;

      const materialiseSession = Effect.fn("materialiseSession")(function*(
        parsed: ParsedSession,
      ) {
        yield* summaryMats.materialise({
          header: parsed.header,
          entries: parsed.entries,
          projectName: parsed.projectName,
        });
        yield* swearMats.materialise({
          sessionId: parsed.header.id,
          entries: parsed.entries,
          projectName: parsed.projectName,
          sessionTitle: parsed.title ?? null,
        });
      });

      return MaterialisationService.of({ materialiseSession });
    }),
  );
}

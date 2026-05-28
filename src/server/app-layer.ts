import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Layer } from "effect";
import { Database } from "~/db/service";
import { PiAdapterService } from "~/features/sessions/adapters/pi";
import { SessionService } from "~/features/sessions/services/session";

export const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const DatabaseLayer = Database.layer.pipe(Layer.provide(PlatformLayer));

export const AppLayer = Layer.mergeAll(PiAdapterService.layer, SessionService.layer).pipe(
  Layer.provide(DatabaseLayer),
  Layer.provide(PlatformLayer),
);

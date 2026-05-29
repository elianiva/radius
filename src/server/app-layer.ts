import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Layer } from "effect";
import { Database } from "~/db/service";
import { PiAdapterService } from "~/features/sessions/adapters/pi";
import { SessionService } from "~/features/sessions/services/session";
import { OverviewService } from "~/features/dashboard/services/overview";
import { HealthService } from "~/features/dashboard/services/health";
import { SessionsService } from "~/features/dashboard/services/sessions";
import { ProjectService } from "~/features/dashboard/services/projects";
import { SwearService } from "~/features/dashboard/services/swear";

export const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

// Layer.mergeAll does NOT auto-resolve deps between merged layers.
// Provide deps explicitly: each service gets the layers it needs to build.
const DatabaseLayer = Database.layer.pipe(Layer.provide(PlatformLayer));
const SessionServiceLayer = SessionService.layer.pipe(Layer.provide(DatabaseLayer));

const CommonDepsLayer = Layer.mergeAll(DatabaseLayer, PlatformLayer, SessionServiceLayer);

const OverviewLayer = OverviewService.layer.pipe(Layer.provide(CommonDepsLayer));
const HealthLayer = HealthService.layer.pipe(Layer.provide(CommonDepsLayer));
const SessionsLayer = SessionsService.layer.pipe(Layer.provide(CommonDepsLayer));
const ProjectLayer = ProjectService.layer.pipe(Layer.provide(CommonDepsLayer));
const SwearLayer = SwearService.layer.pipe(Layer.provide(CommonDepsLayer));

export const AppLayer = Layer.mergeAll(
  PiAdapterService.layer.pipe(Layer.provide(DatabaseLayer), Layer.provide(PlatformLayer)),
  SessionServiceLayer,
  OverviewLayer,
  HealthLayer,
  SessionsLayer,
  ProjectLayer,
  SwearLayer,
);

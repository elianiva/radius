import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Layer } from "effect";
import { Database } from "~/db/service";
import { PiAdapterService } from "~/features/sessions/ingest/pi";
import { OpencodeAdapterService } from "~/features/sessions/ingest/opencode";
import { PersistService } from "~/features/sessions/ingest/persist";
import { SessionSummaryMatsService } from "~/features/sessions/materialisation/summary";
import { SwearMatsService } from "~/features/sessions/materialisation/swear";
import { MaterialisationService } from "~/features/sessions/materialisation/service";
import { IngestService } from "~/features/sessions/service";
import { SessionService } from "~/features/sessions/services/session";
import { OverviewService } from "~/features/dashboard/services/overview";
import { HealthService } from "~/features/dashboard/services/health";
import { FilterOptionsService } from "~/features/dashboard/services/filter-options";
import { SessionsService } from "~/features/dashboard/services/sessions";
import { ProjectService } from "~/features/dashboard/services/projects";
import { SwearService } from "~/features/dashboard/services/swear";
import { WrappedService } from "~/features/wrapped/services/wrapped";

export const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const DatabaseLayer = Database.layer.pipe(Layer.provide(PlatformLayer));
const SessionServiceLayer = SessionService.layer.pipe(Layer.provide(DatabaseLayer));

const CommonDepsLayer = Layer.mergeAll(DatabaseLayer, PlatformLayer, SessionServiceLayer);

const OverviewLayer = OverviewService.layer.pipe(Layer.provide(CommonDepsLayer));
const HealthLayer = HealthService.layer.pipe(Layer.provide(CommonDepsLayer));
const SessionsLayer = SessionsService.layer.pipe(Layer.provide(CommonDepsLayer));
const FilterOptionsLayer = FilterOptionsService.layer.pipe(Layer.provide(CommonDepsLayer));
const ProjectLayer = ProjectService.layer.pipe(Layer.provide(CommonDepsLayer));
const SwearLayer = SwearService.layer.pipe(Layer.provide(CommonDepsLayer));
const WrappedLayer = WrappedService.layer.pipe(Layer.provide(CommonDepsLayer));

// Ingestion layer graph
const PiAdapterLayer = PiAdapterService.layer.pipe(Layer.provide(PlatformLayer));
const PersistLayer = PersistService.layer.pipe(Layer.provide(DatabaseLayer));
const SummaryMatsLayer = SessionSummaryMatsService.layer.pipe(Layer.provide(DatabaseLayer));
const SwearMatsLayer = SwearMatsService.layer.pipe(Layer.provide(DatabaseLayer));
const MatsLayer = MaterialisationService.layer.pipe(
	Layer.provide(SummaryMatsLayer),
	Layer.provide(SwearMatsLayer),
);
const OpencodeAdapterLayer = OpencodeAdapterService.layer;

const IngestLayer = IngestService.layer.pipe(
	Layer.provide(PiAdapterLayer),
	Layer.provide(OpencodeAdapterLayer),
	Layer.provide(PersistLayer),
	Layer.provide(MatsLayer),
);

export const AppLayer = Layer.mergeAll(
	IngestLayer,
	SessionServiceLayer,
	OverviewLayer,
	HealthLayer,
	SessionsLayer,
	ProjectLayer,
	SwearLayer,
	WrappedLayer,
	FilterOptionsLayer,
);

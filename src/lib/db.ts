import { Config, Effect, Match, Option, Path } from "effect";
import { homedir, platform } from "node:os";

export const resolveDbDir = Effect.gen(function*() {
	const path = yield* Path.Path;
	const explicit = yield* Config.option(Config.string("RADIUS_DB_DIR"));
	if (Option.isSome(explicit)) return explicit.value;

	const home = homedir();
	return yield* Match.value(platform()).pipe(
		Match.when("darwin", () =>
			Effect.succeed(path.join(home, "Library", "Application Support", "radius")),
		),
		Match.when("win32", () =>
			Effect.gen(function*() {
				const appData = yield* Config.option(Config.string("APPDATA"));
				return Match.value(appData).pipe(
					Match.tag("Some", (s) => path.join(s.value, "radius")),
					Match.tag("None", () => path.join(home, "AppData", "Roaming", "radius")),
					Match.exhaustive,
				);
			}),
		),
		Match.orElse(() =>
			Effect.gen(function*() {
				const xdgData = yield* Config.option(Config.string("XDG_DATA_HOME"));
				return Match.value(xdgData).pipe(
					Match.tag("Some", (s) =>
						s.value.length > 0
							? path.join(s.value, "radius")
							: path.join(home, ".local", "share", "radius"),
					),
					Match.tag("None", () => path.join(home, ".local", "share", "radius")),
					Match.exhaustive,
				);
			}),
		),
	);
});

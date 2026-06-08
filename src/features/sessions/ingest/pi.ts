import { Context, Data, Effect, FileSystem, Layer, Path } from "effect";
import { homedir } from "node:os";

import { resolveEffectiveLeafTimestamp, type Entry, type ParsedSession, type SessionHeader } from "./adapter";

export class PiIngestError extends Data.TaggedError("PiIngestError")<{
	readonly cause: unknown;
	readonly message: string;
}> {}

export interface FileInfo {
	readonly dir: string;
	readonly file: string;
}

function extractTextContent(content: unknown): string | undefined {
	if (Array.isArray(content)) {
		const text = (content as Array<{ type: string; text?: string }>)
			.filter((c): c is { type: string; text: string } => c.type === "text" && !!c.text)
			.map((c) => c.text)
			.join(" ");
		return text.length > 0 ? text.slice(0, 80) : undefined;
	}
	if (typeof content === "string") {
		return content.slice(0, 80);
	}
	return undefined;
}

export class PiAdapterService extends Context.Service<
	PiAdapterService,
	{
		readonly discover: Effect.Effect<
			{ readonly files: readonly FileInfo[]; readonly totalSessions: number },
			PiIngestError
		>;
		readonly parse: (fileInfo: FileInfo) => Effect.Effect<ParsedSession, PiIngestError>;
	}
>()("radius/PiAdapterService") {
	static readonly layer = Layer.effect(
		PiAdapterService,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const sessionsDir = path.join(homedir(), ".pi/agent/sessions");

			const discover = Effect.gen(function* () {
				const dirEntries = yield* fs
					.readDirectory(sessionsDir)
					.pipe(
						Effect.mapError(
							(cause) => new PiIngestError({ cause, message: "Failed to read sessions directory" }),
						),
					);

				const statResults = yield* Effect.all(
					dirEntries.map((dirName) => {
						const dirPath = path.join(sessionsDir, dirName);
						return fs.stat(dirPath).pipe(
							Effect.mapError(
								(cause) =>
									new PiIngestError({
										cause,
										message: `Failed to stat session directory: ${dirPath}`,
									}),
							),
							Effect.map((stat) =>
								stat.type === "Directory" ? { name: dirName, path: dirPath } : null,
							),
						);
					}),
					{ concurrency: 10 },
				);

				const sessionDirs = statResults.filter(
					(r): r is { name: string; path: string } => r !== null,
				);

				const jsonlResults = yield* Effect.all(
					sessionDirs.map((sessionDir) =>
						fs.readDirectory(sessionDir.path).pipe(
							Effect.mapError(
								(cause) =>
									new PiIngestError({
										cause,
										message: `Failed to read session directory: ${sessionDir.path}`,
									}),
							),
							Effect.map((files) =>
								files
									.filter((f) => f.endsWith(".jsonl"))
									.map((file) => ({ dir: sessionDir.path, file })),
							),
						),
					),
					{ concurrency: 10 },
				);

				const files = jsonlResults.flat();
				return { files, totalSessions: files.length };
			});

			const parse = Effect.fn("parsePiSession")(function* ({ dir, file }: FileInfo) {
				const filePath = path.join(dir, file);
				const content = yield* fs
					.readFileString(filePath)
					.pipe(
						Effect.mapError(
							(cause) =>
								new PiIngestError({ cause, message: `Failed to read session file: ${filePath}` }),
						),
					);

				const lines = content.split("\n").filter(Boolean);
				if (lines.length === 0) {
					return yield* Effect.fail(
						new PiIngestError({ cause: undefined, message: `Empty session file: ${filePath}` }),
					);
				}

				const header: SessionHeader = yield* Effect.try({
					try: () => JSON.parse(lines[0]),
					catch: (cause) =>
						new PiIngestError({ cause, message: `Failed to parse session header: ${filePath}` }),
				});
				if (header.type !== "session") {
					return yield* Effect.fail(
						new PiIngestError({
							cause: undefined,
							message: `Invalid session header in: ${filePath}`,
						}),
					);
				}

				const entries: readonly Entry[] = yield* Effect.try({
					try: () => lines.slice(1).map((l) => JSON.parse(l) as Entry),
					catch: (cause) =>
						new PiIngestError({ cause, message: `Failed to parse session entries: ${filePath}` }),
				});
				const projectName = path.basename(header.cwd);

				let eventCount = 0;
				let sessionEventCount = 0;
				for (const entry of entries) {
					if (entry.type === "message") {
						eventCount++;
					} else {
						sessionEventCount++;
					}
				}

				// Title: latest session_info name > first user message
				let title: string | undefined;
				for (let i = entries.length - 1; i >= 0; i--) {
					const e = entries[i];
					if (e.type === "session_info" && typeof e.name === "string" && e.name.trim()) {
						title = e.name.trim().slice(0, 80);
						break;
					}
				}
				if (!title) {
					const firstUserMessage = entries.find(
						(e) => e.type === "message" && e.message?.role === "user",
					);
					title = firstUserMessage
						? extractTextContent(firstUserMessage.message?.content)
						: undefined;
				}

				const effectiveLeafTimestamp = resolveEffectiveLeafTimestamp(header, entries);

				return { header, entries, title, projectName, eventCount, sessionEventCount, effectiveLeafTimestamp };
			});

			return PiAdapterService.of({ discover, parse });
		}),
	);
}

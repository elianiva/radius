import { Command, Flag } from "effect/unstable/cli";
import { Effect, Option, Path, pipe } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { resolveDbDir } from "~/lib/db";

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

const runMigration = (path: Path.Path, dbDir: string): void => {
	const dbPath = path.join(dbDir, "sessions.db");
	mkdirSync(dbDir, { recursive: true });

	const sqlite = new DatabaseSync(dbPath);
	try {
		sqlite.exec("PRAGMA journal_mode = WAL");
		sqlite.exec("PRAGMA foreign_keys = ON");
		migrate(drizzle({ client: sqlite }), {
			migrationsFolder: fileURLToPath(new URL("../dist/db/migrations", import.meta.url)),
		});
	} finally {
		sqlite.close();
	}
};

// ---------------------------------------------------------------------------
// MIME types
// ---------------------------------------------------------------------------

const mimeTypes: Record<string, string> = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".png": "image/png",
	".ico": "image/x-icon",
	".svg": "image/svg+xml",
	".woff2": "font/woff2",
	".webp": "image/webp",
	".txt": "text/plain",
};

// ---------------------------------------------------------------------------
// Server handler (loaded once at module level)
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

const serverHandler: { fetch: (req: Request) => Promise<Response> } = await import(
	join(__dirname, "../dist/server/server.js")
).then((m) => m.default);

const clientDir = join(__dirname, "../dist/client");

// ---------------------------------------------------------------------------
// CLI definition
// ---------------------------------------------------------------------------

const cmd = Command.make(
	"radius",
	{
		port: pipe(
			Flag.integer("port"),
			Flag.withAlias("p"),
			Flag.withDefault(3000),
			Flag.withDescription("Server port"),
		),
		dbDir: pipe(
			Flag.string("db-dir"),
			Flag.withAlias("d"),
			Flag.optional,
			Flag.withDescription("Database directory (default: XDG data dir)"),
		),
	},
	({ port, dbDir }) =>
		Effect.gen(function* () {
			const path = yield* Path.Path;
			const explicit = Option.getOrUndefined(dbDir);
			const resolvedDbDir = explicit !== undefined ? explicit : yield* resolveDbDir;

			yield* Effect.sync(() => runMigration(path, resolvedDbDir));

			const httpServer = createServer(async (req, res) => {
				try {
					const url = new URL(req.url!, `http://${req.headers.host || "localhost"}`);

					// Serve static files directly
					if (!url.pathname.startsWith("/api/")) {
						const filePath = join(clientDir, url.pathname === "/" ? "index.html" : url.pathname);
						if (existsSync(filePath)) {
							const ext = filePath.substring(filePath.lastIndexOf("."));
							const content = readFileSync(filePath);
							res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
							res.end(content);
							return;
						}
					}

					// Forward to TanStack Start handler
					const body =
						req.method !== "GET" && req.method !== "HEAD"
							? await new Promise<Buffer>((resolve) => {
									const chunks: Buffer[] = [];
									req.on("data", (chunk: Buffer) => chunks.push(chunk));
									req.on("end", () => resolve(Buffer.concat(chunks)));
								})
							: undefined;

					const headers: Record<string, string> = {};
					for (const [key, value] of Object.entries(req.headers)) {
						if (value !== undefined) headers[key] = String(value);
					}

					const response = await serverHandler.fetch(
						new Request(url, {
							method: req.method,
							headers,
							body: body !== undefined ? new Uint8Array(body) : undefined,
						}),
					);

					res.statusCode = response.status;
					response.headers.forEach((value, key) => res.setHeader(key, value));
					if (response.body) {
						for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
							res.write(chunk);
						}
					}
					res.end();
				} catch (err) {
					process.stderr.write(String(err) + "\n");
					if (!res.headersSent) {
						res.writeHead(500, { "Content-Type": "text/plain" });
					}
					res.end("Internal Server Error");
				}
			});

			yield* Effect.addFinalizer(() => Effect.sync(() => httpServer.close()));

			yield* Effect.callback((resume) => {
				httpServer.listen(port, () => resume(Effect.void));
			});

			yield Effect.log("Press Ctrl+C to stop");
			yield Effect.never;
		}),
).pipe(Command.withDescription("AI coding session analytics dashboard"));

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const cli = Command.run(cmd, {
	version: "0.1.0",
});

NodeRuntime.runMain(cli.pipe(Effect.provide(NodeServices.layer), Effect.scoped));

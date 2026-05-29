import { Command, Flag } from "effect/unstable/cli";
import { Effect, Option, pipe } from "effect";
import { NodeRuntime, NodeStdio } from "@effect/platform-node";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir, platform } from "node:os";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
//#region src/cli/main.ts
const resolveDbDir = (explicit) => {
	if (explicit) return explicit;
	const home = homedir();
	const plat = platform();
	if (plat === "darwin") return join(home, "Library", "Application Support", "radius");
	if (plat === "win32") return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "radius");
	const xdgData = process.env.XDG_DATA_HOME;
	if (xdgData && xdgData.length > 0) return join(xdgData, "radius");
	return join(home, ".local", "share", "radius");
};
const runMigration = (dbDir) => {
	const dbPath = join(dbDir, "sessions.db");
	mkdirSync(dbDir, { recursive: true });
	const sqlite = new DatabaseSync(dbPath);
	try {
		sqlite.exec("PRAGMA journal_mode = WAL");
		sqlite.exec("PRAGMA foreign_keys = ON");
		migrate(drizzle({ client: sqlite }), { migrationsFolder: fileURLToPath(new URL("../dist/db/migrations", import.meta.url)) });
	} finally {
		sqlite.close();
	}
};
const mimeTypes = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".png": "image/png",
	".ico": "image/x-icon",
	".svg": "image/svg+xml",
	".woff2": "font/woff2",
	".webp": "image/webp",
	".txt": "text/plain"
};
const __dirname = dirname(fileURLToPath(import.meta.url));
const serverHandler = await import(join(__dirname, "../dist/server/server.js")).then((m) => m.default);
const clientDir = join(__dirname, "../dist/client");
const cmd = Command.make("radius", {
	port: pipe(Flag.integer("port"), Flag.withAlias("p"), Flag.withDefault(3e3), Flag.withDescription("Server port")),
	dbDir: pipe(Flag.string("db-dir"), Flag.withAlias("d"), Flag.optional, Flag.withDescription("Database directory (default: XDG data dir)"))
}, ({ port, dbDir }) => Effect.gen(function* () {
	const resolvedDbDir = resolveDbDir(Option.isSome(dbDir) ? dbDir.value : void 0);
	yield* Effect.sync(() => runMigration(resolvedDbDir));
	const httpServer = createServer(async (req, res) => {
		try {
			const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
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
			const body = req.method !== "GET" && req.method !== "HEAD" ? await new Promise((resolve) => {
				const chunks = [];
				req.on("data", (chunk) => chunks.push(chunk));
				req.on("end", () => resolve(Buffer.concat(chunks)));
			}) : void 0;
			const headers = {};
			for (const [key, value] of Object.entries(req.headers)) if (value !== void 0) headers[key] = String(value);
			const response = await serverHandler.fetch(new Request(url, {
				method: req.method,
				headers,
				body
			}));
			res.statusCode = response.status;
			response.headers.forEach((value, key) => res.setHeader(key, value));
			if (response.body) for await (const chunk of response.body) res.write(chunk);
			res.end();
		} catch (err) {
			process.stderr.write(String(err) + "\n");
			if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain" });
			res.end("Internal Server Error");
		}
	});
	yield* Effect.callback((resume) => {
		httpServer.listen(port, () => resume(Effect.void));
	});
	yield Effect.log("Press Ctrl+C to stop");
	yield Effect.never;
}).pipe(Effect.onInterrupt(() => Effect.sync(() => {
	httpServer.close();
})))).pipe(Command.withDescription("AI coding session analytics dashboard"));
const cli = Command.run(cmd, {
	name: "radius",
	version: "0.1.0"
});
NodeRuntime.runMain(cli.pipe(Effect.provide(NodeStdio.layer)));
//#endregion
export {};

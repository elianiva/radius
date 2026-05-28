# ADR 0001: Local Node.js Dashboard (not Cloudflare Workers)

## Status

Accepted.

## Context

The project was scaffolded with TanStack Start + Cloudflare Workers deployment
(via `@cloudflare/vite-plugin` + `wrangler`). The session database lives at a
local filesystem path (`~/.local/share/radius/sessions.db`) accessed via
`node:sqlite`.

Cloudflare Workers have no local filesystem access. Running SQLite on Workers
would require D1, which moves session data to the cloud — defeating the
privacy goal of keeping all session data on-device.

## Decision

- Remove `@cloudflare/vite-plugin`, `wrangler`, and `wrangler.jsonc`.
- Configure TanStack Start's Nitro server for the `node-server` preset.
- Run locally only — distribution via `npx radius@latest`.
- All session data stays on the user's machine at `~/.local/share/radius/`.

## Consequences

- No production hosting needed. The app runs on `localhost:3000` (or similar).
- `node:sqlite` works natively (no D1, no edge compatibility concerns).
- Users control their data completely — no external service.
- Distribution is via npm package with a `start` script.
- Loses Cloudflare's global edge distribution, but that's irrelevant for a
  single-user local dashboard.

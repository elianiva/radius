# Radius

AI coding session analytics dashboard. Tracks Pi and Opencode sessions — models used, tokens spent, costs, tool calls, swearing, and yearly Wrapped recaps.

## Usage

```bash
npx @elianiva/radius@latest
```

Then open `http://localhost:3000`.

### Options

| Flag          | Default                                 | Description                    |
| ------------- | --------------------------------------- | ------------------------------ |
| `--port, -p`  | `3000`                                  | Server port                    |
| `--db-dir, -d`| Platform XDG data dir                   | Custom database directory      |

### Database location

| Platform | Path                                          |
| -------- | --------------------------------------------- |
| macOS    | `~/Library/Application Support/radius`        |
| Linux    | `$XDG_DATA_HOME/radius` or `~/.local/share/radius` |
| Windows  | `%APPDATA%/radius`                            |

## Features

- **Dashboard** — overview of all sessions, projects, models, tool usage, costs, and swearing stats
- **Session detail** — full event timeline for any session
- **Project view** — sessions grouped by working directory
- **Wrapped** — yearly recap with most-used model, busiest day, total cost, peak tool, swearing stats, and more

## Data sources

Radius reads from two local sources:

- **Pi** — `~/.pi/agent/sessions/*.jsonl`
- **Opencode** — `~/.local/share/opencode/opencode.db`

Ingestion is local-only. No data leaves your machine.

## Dev

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

## License

MIT

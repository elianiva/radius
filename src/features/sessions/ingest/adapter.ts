export interface SessionHeader {
	readonly type: "session";
	readonly version: number;
	readonly id: string;
	readonly timestamp: string;
	readonly cwd: string;
}

export interface Entry {
	readonly type: string;
	readonly id: string;
	readonly parentId: string | null;
	readonly timestamp: string;
	readonly message?: Record<string, unknown>;
	readonly [key: string]: unknown;
}

export interface ParsedSession {
	readonly header: SessionHeader;
	readonly entries: readonly Entry[];
	readonly title: string | undefined;
	readonly projectName: string;
	readonly eventCount: number;
	readonly sessionEventCount: number;
	readonly effectiveLeafTimestamp: number;
}

const BOOKKEEPING_TYPES = new Set([
	"session_info",
	"custom",
	"label",
	"thinking_level_change",
	"model_change",
	"compaction",
	"branch_summary",
]);

/**
 * Pi sessions are trees — bookkeeping entries branch off the main conversation.
 * Find the last message entry to get the real conversation end timestamp.
 */
export function resolveEffectiveLeafTimestamp(
	header: SessionHeader,
	entries: readonly Entry[],
): number {
	const created = new Date(header.timestamp).getTime();

	let lastMessageTs = created;
	for (const entry of entries) {
		if (BOOKKEEPING_TYPES.has(entry.type)) continue;
		const ts = new Date(entry.timestamp).getTime();
		if (ts > lastMessageTs) lastMessageTs = ts;
	}

	return lastMessageTs;
}

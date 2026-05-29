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
}

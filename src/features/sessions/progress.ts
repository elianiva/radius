export type IngestProgress =
	| { readonly stage: "finding-sessions"; readonly label: string; readonly description: string }
	| {
			readonly stage: "opencode-discovering";
			readonly label: string;
			readonly description: string;
	  }
	| {
			readonly stage: "importing-session";
			readonly label: string;
			readonly description: string;
			readonly sessionId: string;
			readonly project: string;
			readonly sessionIndex: number;
			readonly totalSessions: number;
			readonly source: "pi" | "opencode";
			readonly agent?: string;
	  }
	| {
			readonly stage: "done";
			readonly label: string;
			readonly description: string;
			readonly result: {
				readonly files: number;
				readonly sessions: number;
				readonly projects: number;
				readonly events: number;
				readonly sessionEvents: number;
			};
	  };

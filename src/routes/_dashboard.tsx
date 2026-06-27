import { Outlet, Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Suspense, useState, useCallback, useMemo } from "react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import {
	Loader2,
	Sparkles,
	BarChart3,
	Folder,
	List,
	HeartPulse,
	Meh,
	ScrollText,
	Download,
} from "lucide-react";
import { importPiSessions, importOpencodeSessions } from "~/server/rpc/sessions";
import { OverviewRpc } from "~/server/rpc/dashboard/overview";
import { FilterOptionsRpc } from "~/server/rpc/dashboard/filters";
import type { IngestProgress } from "~/features/sessions/progress";
import type { DashboardFilters } from "~/features/dashboard/services/filters";
import { OverviewLoading } from "~/features/dashboard/loading";
import { AppNav } from "~/components/app-nav";
import { FilterBar } from "~/components/filter-bar";
import { QueryErrorBoundary } from "~/components/query-error-boundary";

function parseSearch(raw: Record<string, unknown>): DashboardFilters {
	const result: DashboardFilters = {};
	if (typeof raw.dateFrom === "string") {
		const n = Number(raw.dateFrom);
		if (!Number.isNaN(n)) result.dateFrom = n;
	}
	if (typeof raw.dateTo === "string") {
		const n = Number(raw.dateTo);
		if (!Number.isNaN(n)) result.dateTo = n;
	}
	if (typeof raw.projectIds === "string" && raw.projectIds.length > 0) {
		result.projectIds = raw.projectIds.split(",");
	}
	if (typeof raw.model === "string" && raw.model.length > 0) {
		result.model = raw.model;
	}
	return result;
}

function filtersToParams(filters: DashboardFilters): Record<string, string | undefined> {
	return {
		dateFrom: filters.dateFrom != null ? String(filters.dateFrom) : undefined,
		dateTo: filters.dateTo != null ? String(filters.dateTo) : undefined,
		projectIds: filters.projectIds?.length ? filters.projectIds.join(",") : undefined,
		model: filters.model || undefined,
	};
}

export const Route = createFileRoute("/_dashboard")({
	validateSearch: parseSearch,
	component: DashboardLayout,
});

function Digest({ progress }: { progress: IngestProgress }) {
	const pct =
		"sessionIndex" in progress && "totalSessions" in progress
			? Math.round((progress.sessionIndex / progress.totalSessions) * 100)
			: undefined;

	return (
		<div className="flex flex-col items-center gap-3">
			<div className="relative">
				{progress.stage === "done" ? (
					<Sparkles className="size-8 text-primary animate-in zoom-in fade-in duration-300" />
				) : (
					<>
						<Loader2 className="size-8 animate-spin text-muted-foreground" />
						{pct !== undefined && (
							<span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-muted-foreground">
								{pct}
							</span>
						)}
					</>
				)}
			</div>
			<div className="space-y-1 text-center">
				<p className="text-sm font-medium">{progress.label}</p>
				<p className="text-xs text-muted-foreground">{progress.description}</p>
			</div>
			<div className="h-1 w-48 overflow-hidden rounded-none bg-muted">
				<div
					className={`h-full rounded-none transition-all duration-500 ${
						progress.stage === "done" ? "bg-primary" : "bg-foreground/20"
					}`}
					style={{
						width:
							pct !== undefined
								? `${pct}%`
								: progress.stage === "finding-sessions" || progress.stage === "opencode-discovering"
									? "50%"
									: "100%",
					}}
				/>
			</div>
		</div>
	);
}

function ImportDialog({
	onImport,
	disabled,
}: {
	onImport: (importPi: boolean, importOpencode: boolean) => void;
	disabled: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [importPi, setImportPi] = useState(false);
	const [importOpencode, setImportOpencode] = useState(false);

	const hasSelection = importPi || importOpencode;

	const handleImport = useCallback(() => {
		setOpen(false);
		onImport(importPi, importOpencode);
	}, [importPi, importOpencode, onImport]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button variant="outline" disabled={disabled} />}>
				<Download className="size-4" />
				Import
			</DialogTrigger>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>Import Sessions</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-1">
					<label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 rounded-sm transition-colors">
						<input
							type="checkbox"
							checked={importPi}
							onChange={(e) => setImportPi(e.target.checked)}
							className="size-3.5 accent-foreground"
						/>
						<div className="flex flex-col">
							<span className="text-sm font-medium">Pi</span>
							<span className="text-xs text-muted-foreground">All available sessions</span>
						</div>
					</label>

					<label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 rounded-sm transition-colors">
						<input
							type="checkbox"
							checked={importOpencode}
							onChange={(e) => setImportOpencode(e.target.checked)}
							className="size-3.5 accent-foreground"
						/>
						<div className="flex flex-col">
							<span className="text-sm font-medium">Opencode</span>
							<span className="text-xs text-muted-foreground">All available sessions</span>
						</div>
					</label>
				</div>

				<div className="flex justify-end gap-2 pt-2">
					<Button variant="default" disabled={!hasSelection} onClick={handleImport}>
						Import Selected
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function DashboardLayout() {
	const queryClient = useQueryClient();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const [ingestProgress, setIngestProgress] = useState<IngestProgress | null>(null);
	const [isImporting, setIsImporting] = useState(false);

	const { data: summary } = useQuery(OverviewRpc.overviewCards());

	const filters: DashboardFilters = useMemo(
		() => ({
			dateFrom: search.dateFrom,
			dateTo: search.dateTo,
			projectIds: search.projectIds,
			model: search.model,
		}),
		[search.dateFrom, search.dateTo, search.projectIds, search.model],
	);

	const { data: projectNames } = useQuery(FilterOptionsRpc.projectNames());
	const { data: modelNames } = useQuery(FilterOptionsRpc.modelNames());

	const handleFiltersChange = useCallback(
		(next: DashboardFilters) => {
			void navigate({ search: filtersToParams(next) as Record<string, string>, replace: true });
		},
		[navigate],
	);

	const handleImport = useCallback(
		async (doPi: boolean, doOpencode: boolean) => {
			setIsImporting(true);
			if (doPi) {
				const stream = await importPiSessions();
				for await (const progress of stream) {
					setIngestProgress(progress);
				}
			}

			if (doOpencode) {
				const stream = await importOpencodeSessions();
				for await (const progress of stream) {
					setIngestProgress(progress);
				}
			}

			setIngestProgress(null);
			setIsImporting(false);
			void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
		},
		[queryClient],
	);

	const links = [
		{ to: "/overview", label: "Overview", icon: BarChart3 },
		{ to: "/health", label: "Health", icon: HeartPulse },
		{ to: "/projects", label: "Projects", icon: Folder },
		{ to: "/sessions", label: "Sessions", icon: List },
		{ to: "/swearing", label: "Swearing", icon: Meh },
		{ to: "/wrapped", label: "Wrapped", icon: ScrollText },
	] as const;

	return (
		<main className="flex min-h-screen flex-col gap-6 p-8 max-w-5xl mx-auto">
			<div className="flex items-center justify-between">
				<Link to="/overview" className="text-2xl font-bold tracking-tight">
					Radius
				</Link>

				<ImportDialog onImport={handleImport} disabled={isImporting} />
			</div>

			{isImporting && ingestProgress ? (
				<div className="flex items-center justify-center rounded border py-16">
					<Digest progress={ingestProgress} />
				</div>
			) : summary?.totalSessions === 0 ? (
				<div className="flex flex-col items-center justify-center gap-4 rounded border py-16">
					<p className="text-muted-foreground">No sessions yet</p>
					<ImportDialog onImport={handleImport} disabled={isImporting} />
				</div>
			) : (
				<>
					<FilterBar
						filters={filters}
						onFiltersChange={handleFiltersChange}
						projects={projectNames ?? []}
						models={modelNames ?? []}
					/>
					<AppNav items={links} />
					<QueryErrorBoundary>
						<Suspense fallback={<OverviewLoading />}>
							<Outlet />
						</Suspense>
					</QueryErrorBoundary>
				</>
			)}
		</main>
	);
}

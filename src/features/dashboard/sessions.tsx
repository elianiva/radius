import { Suspense, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Clock, MessageSquare, AlertTriangle, Coins, Table2, Grid3x3 } from "lucide-react";
import { formatCost, formatTokens, formatDuration } from "~/lib/utils";
import { SessionsTableLoading } from "./loading";
import { DataTable, type Column } from "~/components/ui/data-table";
import type { DashboardFilters } from "./services/filters";
import type { ExtendedSession } from "./types";
import { useCursorPagination } from "~/hooks/use-cursor-pagination";
import { SessionsRpc } from "~/server/rpc/dashboard/sessions";

type SortKey =
	| "createdAt"
	| "duration"
	| "totalCost"
	| "messageCount"
	| "totalTokens"
	| "toolErrorCount";

const SORT_DIRS: Record<SortKey, { sortBy: string; sortDir: "asc" | "desc" }> = {
	createdAt: { sortBy: "createdAt", sortDir: "desc" },
	duration: { sortBy: "duration", sortDir: "desc" },
	totalCost: { sortBy: "totalCost", sortDir: "desc" },
	messageCount: { sortBy: "messageCount", sortDir: "desc" },
	totalTokens: { sortBy: "totalTokens", sortDir: "desc" },
	toolErrorCount: { sortBy: "toolErrorCount", sortDir: "desc" },
};

const sessionColumns: Column<ExtendedSession>[] = [
	{
		id: "title",
		header: "Title",
		accessor: (s) => (
			<span className="line-clamp-1 font-medium max-w-48">{s.title ?? "(untitled)"}</span>
		),
	},
	{
		id: "createdAt",
		header: "Date",
		accessor: (s) => (
			<span className="font-mono text-muted-foreground">
				{new Date(s.createdAt).toLocaleDateString(undefined, {
					month: "short",
					day: "numeric",
				})}
			</span>
		),
		sortKey: (s) => s.createdAt,
	},
	{
		id: "duration",
		header: "Duration",
		headerClassName: "text-right",
		className: "text-right font-mono tabular-nums",
		accessor: (s) => formatDuration(s.duration),
		sortKey: (s) => s.duration,
	},
	{
		id: "totalCost",
		header: "Cost",
		headerClassName: "text-right",
		className: "text-right font-mono tabular-nums",
		accessor: (s) => formatCost(s.totalCost),
		sortKey: (s) => s.totalCost,
	},
	{
		id: "messageCount",
		header: "Messages",
		headerClassName: "text-right",
		className: "text-right font-mono tabular-nums",
		accessor: (s) => String(s.messageCount),
		sortKey: (s) => s.messageCount,
	},
	{
		id: "totalTokens",
		header: "Tokens",
		headerClassName: "text-right",
		className: "text-right font-mono tabular-nums text-muted-foreground",
		accessor: (s) => formatTokens(s.totalTokens),
		sortKey: (s) => s.totalTokens,
	},
	{
		id: "models",
		header: "Models",
		accessor: (s) => (
			<div className="flex flex-wrap gap-1">
				{s.models.slice(0, 3).map((m) => (
					<Badge key={m} variant="secondary" className="text-[10px]">
						{m}
					</Badge>
				))}
				{s.models.length > 3 && (
					<Badge variant="outline" className="text-[10px]">
						+{s.models.length - 3}
					</Badge>
				)}
			</div>
		),
	},
	{
		id: "toolErrorCount",
		header: "Errors",
		headerClassName: "text-right",
		className: "text-right font-mono tabular-nums",
		accessor: (s) =>
			s.toolErrorCount > 0 ? (
				<span className="text-destructive">{s.toolErrorCount}</span>
			) : (
				<span className="text-muted-foreground">—</span>
			),
		sortKey: (s) => s.toolErrorCount,
	},
];

export function Sessions({ filters }: { filters?: DashboardFilters }) {
	return (
		<Suspense fallback={<SessionsTableLoading rows={10} />}>
			<SessionsContent filters={filters} />
		</Suspense>
	);
}

function SessionsContent({ filters }: { filters?: DashboardFilters }) {
	const router = useRouter();
	const [view, setView] = useState<"grid" | "table">("table");
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState<SortKey>("createdAt");
	const pagination = useCursorPagination();

	const sort = SORT_DIRS[sortBy];

	const { data, isFetching } = useQuery({
		...SessionsRpc.list(
			searchQuery || undefined,
			sort.sortBy,
			sort.sortDir,
			pagination.cursor,
			filters,
		),
		placeholderData: (prev) => prev,
	});

	const items = (data?.items ?? []) as ExtendedSession[];
	const totalPages = data?.totalPages ?? 1;
	const currentPage = data?.currentPage ?? 1;
	const nextCursor = data?.nextCursor;

	const goNext = useCallback(() => {
		if (!nextCursor) return;
		pagination.goNext(nextCursor);
	}, [nextCursor, pagination]);

	const goPrev = useCallback(() => {
		pagination.goPrev();
	}, [pagination]);

	const handleSort = useCallback(
		(key: string) => {
			setSortBy(key as SortKey);
			pagination.reset();
		},
		[pagination],
	);

	const handleSearch = useCallback(
		(query: string) => {
			setSearchQuery(query);
			pagination.reset();
		},
		[pagination],
	);

	return (
		<div className="flex flex-col gap-4">
			{items.length === 0 && !isFetching && !searchQuery ? (
				<Card>
					<CardContent className="flex items-center justify-center py-12 text-muted-foreground">
						No sessions yet. Import sessions from the dashboard.
					</CardContent>
				</Card>
			) : (
				<>
					<div className="flex items-start justify-between">
						<p className="pt-2 text-sm text-muted-foreground">
							{isFetching ? "…" : `${data?.items?.length ?? 0} sessions`}
						</p>

						<div className="flex items-center gap-2">
							<Tabs
								value={view}
								onValueChange={(v: string) => setView(v as "grid" | "table")}
								className="min-w-0"
							>
								<TabsList>
									<TabsTrigger value="table">
										<Table2 className="size-3.5" />
										Table
									</TabsTrigger>
									<TabsTrigger value="grid">
										<Grid3x3 className="size-3.5" />
										Grid
									</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
					</div>

					{view === "table" ? (
						<DataTable
							columns={sessionColumns}
							data={items}
							page={currentPage}
							totalPages={totalPages}
							onPageChange={(p) => (p > currentPage ? goNext() : goPrev())}
							sortKey={sort.sortBy}
							sortDir={sort.sortDir}
							onSort={handleSort}
							searchQuery={searchQuery}
							onSearchChange={handleSearch}
							searchPlaceholder="Search by title, project, model…"
							getRowLink={(s) => `/sessions/${s.id}`}
							loading={isFetching}
						/>
					) : (
						<SessionGrid sessions={items} router={router} />
					)}
				</>
			)}
		</div>
	);
}

function SessionGrid({
	sessions,
	router,
}: {
	sessions: ExtendedSession[];
	router: ReturnType<typeof useRouter>;
}) {
	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{sessions.map((session) => (
				<Card
					key={session.id}
					className="cursor-pointer transition-colors hover:bg-muted/50"
					onClick={() =>
						router.navigate({
							to: "/sessions/$sessionId",
							params: { sessionId: session.id },
						})
					}
				>
					<CardHeader>
						<CardTitle className="line-clamp-1 text-sm">{session.title ?? "(untitled)"}</CardTitle>
						<CardDescription className="flex flex-wrap gap-1">
							{session.models.slice(0, 3).map((m) => (
								<Badge key={m} variant="secondary" className="text-[10px]">
									{m}
								</Badge>
							))}
							{session.models.length > 3 && (
								<Badge variant="outline" className="text-[10px]">
									+{session.models.length - 3}
								</Badge>
							)}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div className="flex items-center gap-1.5 text-muted-foreground">
								<Clock className="size-3" />
								<span className="font-mono">{formatDuration(session.duration)}</span>
							</div>
							<div className="flex items-center gap-1.5 text-muted-foreground">
								<MessageSquare className="size-3" />
								<span className="font-mono">{session.messageCount}</span>
							</div>
							<div className="flex items-center gap-1.5 text-muted-foreground">
								<Coins className="size-3" />
								<span className="font-mono">{formatTokens(session.totalTokens)}</span>
							</div>
							<div className="flex items-center gap-1.5 text-muted-foreground">
								<span className="font-mono">{formatCost(session.totalCost)}</span>
							</div>
							{session.toolErrorCount > 0 && (
								<div className="col-span-2 flex items-center gap-1.5 text-destructive">
									<AlertTriangle className="size-3" />
									<span className="font-mono">{session.toolErrorCount} errors</span>
								</div>
							)}
						</div>
						<div className="mt-2 text-[10px] text-muted-foreground">
							{new Date(session.createdAt).toLocaleDateString(undefined, {
								month: "short",
								day: "numeric",
								hour: "2-digit",
								minute: "2-digit",
							})}
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

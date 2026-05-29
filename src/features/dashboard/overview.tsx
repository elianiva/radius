import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { ChartCardSkeleton, ChartSkeleton, HeatmapSkeleton } from "./loading";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "~/components/ui/chart";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	Pie,
	PieChart,
	Cell,
	XAxis,
	YAxis,
} from "recharts";
import type {
	DashboardMetrics,
	CostOverTime,
	ModelUsage,
	ThinkingLevelUsage,
	StopReason,
} from "./types";
import { HeatmapGrid } from "~/components/ui/heatmap-grid";
import { buildHeatmapWeeks } from "~/lib/heatmap";
import { useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
	DollarSign,
	MessageSquare,
	Coins,
	TrendingUp,
	CalendarDays,
	AlertTriangle,
	Brain,
	StopCircle,
} from "lucide-react";
import { formatCost, formatTokens } from "~/lib/utils";

const costChartConfig = {
	cost: {
		label: "Cost",
		color: "var(--chart-1)",
	},
	sessions: {
		label: "Sessions",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

const COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

const THINKING_COLORS = [
	"var(--chart-1)",
	"var(--chart-3)",
	"var(--chart-5)",
	"var(--chart-2)",
	"var(--chart-4)",
];

const STOP_REASON_LABELS: Record<string, string> = {
	toolUse: "Tool Use",
	endTurn: "End Turn",
	abort: "Aborted",
	maxTokens: "Max Tokens",
	stop: "Stop",
};

function CustomLegend({ data }: { data: { model: string; fill: string }[] }) {
	const top = data.slice(0, 5);
	const hasMore = data.length > 5;

	return (
		<div className="flex flex-col gap-1 pt-4 text-left">
			<span className="mb-1 text-xs font-medium text-muted-foreground">Models</span>
			{top.map((entry) => (
				<div key={entry.model} className="flex items-center gap-2 text-xs">
					<span className="size-2 shrink-0" style={{ backgroundColor: entry.fill }} />
					<span>{entry.model}</span>
				</div>
			))}
			{hasMore && <div className="text-xs text-muted-foreground">+{data.length - 5} more</div>}
		</div>
	);
}

interface OverviewProps {
	cards: {
		totalSessions: number;
		totalCost: number;
		avgCostPerSession: number;
		totalTokens: number;
		errorRate: number;
		mostUsedModel: {
			name: string;
			count: number;
		};
	};
	costOverTime?: CostOverTime[];
	modelUsage?: ModelUsage[];
	topProjects?: readonly {
		name: string;
		sessionCount: number;
		cost: number;
	}[];
	thinkingLevels?: ThinkingLevelUsage[];
	stopReasons?: StopReason[];
	isLoading?: {
		costOverTime?: boolean;
		modelUsage?: boolean;
		topProjects?: boolean;
		thinkingLevels?: boolean;
		stopReasons?: boolean;
	};
}

function ActivityHeatmap({ data }: { data: DashboardMetrics["costOverTime"] }) {
	const weeks = useMemo(
		() =>
			buildHeatmapWeeks(
				data.map((d) => ({
					date: d.date,
					sessionCount: d.sessions,
					cost: d.cost,
				})),
			),
		[data],
	);

	return (
		<Card className="lg:col-span-3">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<CalendarDays className="size-4 text-muted-foreground" />
					Activity
				</CardTitle>
				<CardDescription>Daily session activity over the past year</CardDescription>
			</CardHeader>
			<CardContent>
				<HeatmapGrid weeks={weeks} />
			</CardContent>
		</Card>
	);
}

function SummaryCards({ cards }: { cards: OverviewProps["cards"] }) {
	const items = [
		{
			description: "Total Sessions",
			value: cards.totalSessions,
			icon: MessageSquare,
			format: (v: number) => String(v),
		},
		{
			description: "Total Cost",
			value: cards.totalCost,
			icon: DollarSign,
			format: formatCost,
		},
		{
			description: "Avg Cost/Session",
			value: cards.avgCostPerSession,
			icon: TrendingUp,
			format: formatCost,
		},
		{
			description: "Total Tokens",
			value: cards.totalTokens,
			icon: Coins,
			format: formatTokens,
		},
	] satisfies {
		description: string;
		value: number;
		icon: React.FC<{ className?: string }>;
		format: (v: number) => string;
	}[];

	return (
		<>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{items.map(({ description, value, icon: Icon, format }) => (
					<Card key={description}>
						<CardHeader>
							<CardDescription>{description}</CardDescription>
							<CardTitle className="flex items-center gap-2 text-2xl font-bold tabular-nums">
								<Icon className="size-4 text-muted-foreground" />
								{format(value)}
							</CardTitle>
						</CardHeader>
					</Card>
				))}
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="secondary" className="flex items-center gap-1.5 text-xs">
					<Brain className="size-3" />
					Most used: {cards.mostUsedModel.name}
				</Badge>
				<Badge
					variant={cards.errorRate > 0.2 ? "destructive" : "secondary"}
					className="flex items-center gap-1.5 text-xs"
				>
					<AlertTriangle className="size-3" />
					Error rate: {(cards.errorRate * 100).toFixed(1)}%
				</Badge>
			</div>
		</>
	);
}

function aggregateWeeks(data: CostOverTime[]) {
	const weeks = new Map<string, { start: string; cost: number; sessions: number }>();

	for (const d of data) {
		const date = new Date(d.date + "T00:00:00Z");
		const dayOfWeek = date.getUTCDay();
		const monday = new Date(date);
		monday.setUTCDate(date.getUTCDate() - ((dayOfWeek + 6) % 7));
		const key = monday.toISOString().split("T")[0]!;

		const existing = weeks.get(key) ?? { start: key, cost: 0, sessions: 0 };
		existing.cost += d.cost;
		existing.sessions += d.sessions;
		weeks.set(key, existing);
	}

	return Array.from(weeks.values()).sort((a, b) => a.start.localeCompare(b.start));
}

function CostOverTimeChart({ data }: { data: CostOverTime[] }) {
	const [view, setView] = useState<"daily" | "weekly">("daily");

	const chartData = useMemo(() => {
		if (view === "weekly") return aggregateWeeks(data);
		return data;
	}, [data, view]);

	const dateFormatter = useMemo(() => {
		if (view === "weekly") {
			return (v: string) => {
				const d = new Date(v + "T00:00:00Z");
				return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
			};
		}
		return (v: string) => {
			const d = new Date(v);
			return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
		};
	}, [view]);

	return (
		<Card className="lg:col-span-2">
			<CardHeader className="flex! flex-row items-center justify-between">
				<div>
					<CardTitle>Cost Over Time</CardTitle>
					<CardDescription>Daily cost and session count</CardDescription>
				</div>
				<Tabs value={view} onValueChange={(v: string) => setView(v as "daily" | "weekly")}>
					<TabsList>
						<TabsTrigger value="daily">Daily</TabsTrigger>
						<TabsTrigger value="weekly">Weekly</TabsTrigger>
					</TabsList>
				</Tabs>
			</CardHeader>
			<CardContent>
				<ChartContainer config={costChartConfig} className="h-90 w-full">
					<AreaChart data={chartData}>
						<CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
						<XAxis
							dataKey={view === "weekly" ? "start" : "date"}
							tickLine={false}
							axisLine={false}
							tickFormatter={dateFormatter}
						/>
						<YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(2)}`} />
						<ChartTooltip
							content={
								<ChartTooltipContent
									labelFormatter={(label) => {
										const d = new Date(view === "weekly" ? label + "T00:00:00Z" : label);
										return d.toLocaleDateString(undefined, {
											month: "short",
											day: "numeric",
											year: "numeric",
										});
									}}
									formatter={(value, name) => (
										<div className="flex items-center gap-2 font-mono">
											<span className="text-foreground">
												{name === "cost" ? "Cost" : "Sessions"}
											</span>
											<span className="text-muted-foreground">
												{name === "cost" ? formatCost(value as number) : String(value)}
											</span>
										</div>
									)}
								/>
							}
						/>

						<Area
							type="monotone"
							dataKey="cost"
							stroke="var(--chart-1)"
							fill="var(--chart-1)"
							fillOpacity={0.2}
						/>
						<Area type="monotone" dataKey="sessions" stroke="none" fill="none" activeDot={false} />
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

function ModelUsageChart({ data }: { data: ModelUsage[] }) {
	const modelPieData = data.map((m, i) => ({
		model: m.model,
		count: m.count,
		fill: COLORS[i % COLORS.length],
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Model Usage</CardTitle>
				<CardDescription>Sessions per model</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={{}} className="h-90 w-full">
					<PieChart>
						<ChartTooltip
							content={
								<ChartTooltipContent
									formatter={(value, _name, item) => (
										<div className="flex items-center gap-2 font-mono">
											<span className="text-foreground">{item.payload.model}</span>
											<span className="text-muted-foreground">{value} sessions</span>
										</div>
									)}
								/>
							}
						/>
						<Pie
							data={modelPieData}
							dataKey="count"
							nameKey="model"
							cx="50%"
							cy="50%"
							outerRadius={100}
						/>
						<Legend
							align="left"
							verticalAlign="bottom"
							content={<CustomLegend data={modelPieData} />}
						/>
					</PieChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

function TopProjectsChart({ data }: { data: OverviewProps["topProjects"] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Top Projects</CardTitle>
				<CardDescription>By session count</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={{}} className="h-50 w-full">
					<BarChart data={data} layout="vertical">
						<CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
						<XAxis type="number" tickLine={false} axisLine={false} />
						<YAxis
							type="category"
							dataKey="name"
							tickLine={false}
							axisLine={false}
							width={120}
							tickFormatter={(v) => (v.length > 15 ? v.slice(0, 15) + "…" : v)}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									formatter={(value, name) => (
										<span className="font-mono">
											{name === "cost" ? formatCost(value as number) : value}
										</span>
									)}
								/>
							}
						/>
						<Bar dataKey="sessionCount" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

function ThinkingLevelChart({ data }: { data: ThinkingLevelUsage[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Brain className="size-4 text-muted-foreground" />
					Thinking Levels
				</CardTitle>
				<CardDescription>Distribution of thinking modes used</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={{}} className="h-50 w-full">
					<BarChart data={data} layout="vertical">
						<CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
						<XAxis type="number" tickLine={false} axisLine={false} />
						<YAxis type="category" dataKey="level" tickLine={false} axisLine={false} width={100} />
						<ChartTooltip
							content={
								<ChartTooltipContent
									formatter={(value) => <span className="font-mono">{value} sessions</span>}
								/>
							}
						/>
						<Bar dataKey="count" radius={[0, 4, 4, 0]}>
							{data.map((_, i) => (
								<Cell key={i} fill={THINKING_COLORS[i % THINKING_COLORS.length]} />
							))}
						</Bar>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

function StopReasonsChart({ data }: { data: StopReason[] }) {
	const total = data.reduce((sum, r) => sum + r.count, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<StopCircle className="size-4 text-muted-foreground" />
					Stop Reasons
				</CardTitle>
				<CardDescription>How sessions end</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{data.map((r, i) => {
						const pct = total > 0 ? ((r.count / total) * 100).toFixed(0) : "0";
						return (
							<div key={r.reason}>
								<div className="mb-1 flex items-center justify-between text-xs">
									<span>{STOP_REASON_LABELS[r.reason] ?? r.reason}</span>
									<span className="font-mono text-muted-foreground">
										{r.count} ({pct}%)
									</span>
								</div>
								<div className="h-2 w-full overflow-hidden rounded-none bg-muted">
									<div
										className="h-full rounded-none transition-all"
										style={{
											width: `${pct}%`,
											backgroundColor: COLORS[i % COLORS.length],
										}}
									/>
								</div>
							</div>
						);
					})}
					{data.length === 0 && (
						<p className="text-xs text-muted-foreground">No stop reason data</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export function Overview({
	cards,
	costOverTime,
	modelUsage,
	topProjects,
	thinkingLevels,
	stopReasons,
	isLoading = {},
}: OverviewProps) {
	return (
		<div className="flex flex-col gap-4">
			<SummaryCards cards={cards} />

			<div className="grid gap-4 lg:grid-cols-3">
				{isLoading.costOverTime ? (
					<ChartCardSkeleton rows={5} className="lg:col-span-2" />
				) : (
					<CostOverTimeChart data={costOverTime!} />
				)}
				{isLoading.modelUsage ? (
					<Card>
						<CardHeader>
							<CardDescription className="h-3 w-24 animate-pulse rounded bg-muted" />
						</CardHeader>
						<CardContent className="flex justify-center">
							<div className="size-32 animate-pulse rounded-none bg-muted" />
						</CardContent>
					</Card>
				) : (
					<ModelUsageChart data={modelUsage!} />
				)}
			</div>

			{isLoading.topProjects ? (
				<Card>
					<CardHeader>
						<CardDescription className="h-3 w-24 animate-pulse rounded bg-muted" />
					</CardHeader>
					<CardContent>
						<ChartSkeleton className="h-50" />
					</CardContent>
				</Card>
			) : (
				<TopProjectsChart data={topProjects!} />
			)}

			<div className="grid gap-4 lg:grid-cols-2">
				{isLoading.thinkingLevels ? (
					<ChartCardSkeleton rows={3} />
				) : (
					<ThinkingLevelChart data={thinkingLevels!} />
				)}
				{isLoading.stopReasons ? (
					<Card>
						<CardHeader>
							<CardDescription className="h-3 w-28 animate-pulse rounded bg-muted" />
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{Array.from({ length: 5 }).map((_, i) => (
									<div key={i}>
										<div className="mb-1 flex items-center justify-between">
											<div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
											<div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
										</div>
										<div className="h-2 w-full animate-pulse rounded bg-muted" />
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				) : (
					<StopReasonsChart data={stopReasons!} />
				)}
			</div>

			{isLoading.costOverTime ? (
				<Card>
					<CardHeader>
						<CardDescription className="h-3 w-16 animate-pulse rounded bg-muted" />
					</CardHeader>
					<CardContent>
						<HeatmapSkeleton />
					</CardContent>
				</Card>
			) : (
				<ActivityHeatmap data={costOverTime!} />
			)}
		</div>
	);
}

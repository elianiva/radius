import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, Cell, XAxis, YAxis } from "recharts";
import type { ProjectDetail } from "./types";
import { Badge } from "~/components/ui/badge";
import { Folder, Clock, MessageSquare, AlertTriangle, Coins } from "lucide-react";
import { formatCost, formatTokens, formatDuration } from "~/lib/utils";
import { Link } from "@tanstack/react-router";

const CHART_COLORS = [
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

interface ProjectDetailViewProps {
	data: ProjectDetail;
}

type SortKey = "createdAt" | "duration" | "totalCost" | "messageCount";

function SessionTable({ sessions }: { sessions: ProjectDetail["sessions"] }) {
	const [sortKey, setSortKey] = useState<SortKey>("createdAt");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

	const sorted = useMemo(() => {
		const copy = [...sessions];
		copy.sort((a, b) => {
			const cmp = a[sortKey] > b[sortKey] ? 1 : a[sortKey] < b[sortKey] ? -1 : 0;
			return sortDir === "asc" ? cmp : -cmp;
		});
		return copy;
	}, [sessions, sortKey, sortDir]);

	const toggle = (key: SortKey) => {
		if (sortKey === key) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir("desc");
		}
	};

	const SortHeader = ({ label, sort }: { label: string; sort: SortKey }) => (
		<th
			className="cursor-pointer px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
			onClick={() => toggle(sort)}
		>
			{label}
			{sortKey === sort && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
		</th>
	);

	return (
		<div className="overflow-x-auto rounded border">
			<table className="w-full text-xs">
				<thead>
					<tr className="border-b bg-muted/50">
						<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Title</th>
						<SortHeader label="Date" sort="createdAt" />
						<SortHeader label="Duration" sort="duration" />
						<SortHeader label="Cost" sort="totalCost" />
						<SortHeader label="Messages" sort="messageCount" />
						<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
							Tokens
						</th>
						<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
							Models
						</th>
						<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
							Errors
						</th>
					</tr>
				</thead>
				<tbody>
					{sorted.map((s) => (
						<tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
							<td className="max-w-48 truncate px-3 py-2">
								<Link
									to="/sessions/$sessionId"
									params={{ sessionId: s.id }}
									className="hover:underline"
								>
									{s.title ?? "(untitled)"}
								</Link>
							</td>
							<td className="px-3 py-2 font-mono text-muted-foreground">
								{new Date(s.createdAt).toLocaleDateString(undefined, {
									month: "short",
									day: "numeric",
								})}
							</td>
							<td className="px-3 py-2 font-mono">{formatDuration(s.duration)}</td>
							<td className="px-3 py-2 font-mono">{formatCost(s.totalCost)}</td>
							<td className="px-3 py-2 font-mono">{s.messageCount}</td>
							<td className="px-3 py-2 font-mono text-muted-foreground">
								{formatTokens(s.totalTokens)}
							</td>
							<td className="px-3 py-2">
								<div className="flex flex-wrap gap-1">
									{s.models.map((m) => (
										<Badge key={m} variant="secondary" className="text-[10px]">
											{m}
										</Badge>
									))}
								</div>
							</td>
							<td className="px-3 py-2">
								{s.toolErrorCount > 0 ? (
									<span className="flex items-center gap-1 font-mono text-destructive">
										<AlertTriangle className="size-3" />
										{s.toolErrorCount}
									</span>
								) : (
									<span className="text-muted-foreground">—</span>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function ProjectDetailView({ data }: ProjectDetailViewProps) {
	const { project, sessions, modelUsage, thinkingLevels } = data;

	const modelPieData = modelUsage.map((m, i) => ({
		model: m.model,
		count: m.count,
		fill: CHART_COLORS[i % CHART_COLORS.length],
	}));

	const thinkingData = thinkingLevels.map((t, i) => ({
		level: t.level,
		count: t.count,
		fill: THINKING_COLORS[i % THINKING_COLORS.length],
	}));

	return (
		<div className="flex flex-col gap-4">
			{/* Project header */}
			<div className="flex items-center gap-3">
				<Folder className="size-5 text-muted-foreground" />
				<div>
					<h2 className="text-lg font-semibold">{project.name}</h2>
					<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
						<span>{project.sessionCount} sessions</span>
						<span>{formatCost(project.totalCost)} total</span>
						<span>{(project.errorRate * 100).toFixed(1)}% error rate</span>
						<Badge variant="secondary" className="text-[10px]">
							{project.mostUsedModel}
						</Badge>
					</div>
				</div>
			</div>

			{/* Stats cards */}
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Card>
					<CardHeader>
						<CardDescription>Avg Duration</CardDescription>
						<CardTitle className="flex items-center gap-2 text-xl font-bold tabular-nums">
							<Clock className="size-4 text-muted-foreground" />
							{formatDuration(project.avgDuration)}
						</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader>
						<CardDescription>Avg Messages</CardDescription>
						<CardTitle className="flex items-center gap-2 text-xl font-bold tabular-nums">
							<MessageSquare className="size-4 text-muted-foreground" />
							{project.avgMessagesPerSession.toFixed(1)}
						</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader>
						<CardDescription>Error Rate</CardDescription>
						<CardTitle className="flex items-center gap-2 text-xl font-bold tabular-nums">
							<AlertTriangle className="size-4 text-muted-foreground" />
							{(project.errorRate * 100).toFixed(1)}%
						</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader>
						<CardDescription>Avg Cost</CardDescription>
						<CardTitle className="flex items-center gap-2 text-xl font-bold tabular-nums">
							<Coins className="size-4 text-muted-foreground" />
							{formatCost(project.totalCost / project.sessionCount)}
						</CardTitle>
					</CardHeader>
				</Card>
			</div>

			{/* Charts */}
			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Model Usage</CardTitle>
						<CardDescription>Sessions per model</CardDescription>
					</CardHeader>
					<CardContent>
						<ChartContainer config={{}} className="h-60 w-full">
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
									outerRadius={80}
								/>
							</PieChart>
						</ChartContainer>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Thinking Levels</CardTitle>
						<CardDescription>Distribution of thinking modes</CardDescription>
					</CardHeader>
					<CardContent>
						{thinkingData.length === 0 ? (
							<p className="flex h-60 items-center justify-center text-xs text-muted-foreground">
								No thinking level data
							</p>
						) : (
							<ChartContainer config={{}} className="h-60 w-full">
								<BarChart data={thinkingData} layout="vertical">
									<CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
									<XAxis type="number" tickLine={false} axisLine={false} />
									<YAxis
										type="category"
										dataKey="level"
										tickLine={false}
										axisLine={false}
										width={100}
									/>
									<ChartTooltip
										content={
											<ChartTooltipContent
												formatter={(value) => <span className="font-mono">{value} sessions</span>}
											/>
										}
									/>
									<Bar dataKey="count" radius={[0, 4, 4, 0]}>
										{thinkingData.map((entry, i) => (
											<Cell key={i} fill={entry.fill} />
										))}
									</Bar>
								</BarChart>
							</ChartContainer>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Session table */}
			<Card>
				<CardHeader>
					<CardTitle>Sessions</CardTitle>
					<CardDescription>Click column headers to sort</CardDescription>
				</CardHeader>
				<CardContent>
					<SessionTable sessions={sessions} />
				</CardContent>
			</Card>
		</div>
	);
}

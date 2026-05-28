import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
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
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardMetrics } from "./types";
import { HeatmapGrid } from "~/components/ui/heatmap-grid";
import { buildHeatmapWeeks } from "~/lib/heatmap";
import { useMemo } from "react";
import { DollarSign, MessageSquare, Coins, TrendingUp, CalendarDays } from "lucide-react";
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

const modelChartConfig = {
  count: {
    label: "Sessions",
  },
} satisfies ChartConfig;

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function CustomLegend({ data }: { data: { model: string; fill: string }[] }) {
  const top = data.slice(0, 5);
  const hasMore = data.length > 5;

  return (
    <div className="flex flex-col gap-1 pt-4 text-left">
      <span className="mb-1 text-xs font-medium text-muted-foreground">Models</span>
      {top.map((entry) => (
        <div key={entry.model} className="flex items-center gap-2 text-xs">
          <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: entry.fill }} />
          <span>{entry.model}</span>
        </div>
      ))}
      {hasMore && <div className="text-xs text-muted-foreground">+{data.length - 5} more</div>}
    </div>
  );
}

interface OverviewProps {
  metrics: DashboardMetrics;
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

function SummaryCards({ metrics }: OverviewProps) {
  const cards = [
    {
      description: "Total Sessions",
      value: metrics.totalSessions,
      icon: MessageSquare,
      format: (v: number) => String(v),
    },
    {
      description: "Total Cost",
      value: metrics.totalCost,
      icon: DollarSign,
      format: formatCost,
    },
    {
      description: "Avg Cost/Session",
      value: metrics.avgCostPerSession,
      icon: TrendingUp,
      format: formatCost,
    },
    {
      description: "Total Tokens",
      value: metrics.totalTokens,
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
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ description, value, icon: Icon, format }) => (
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
  );
}

function CostOverTimeChart({ data }: { data: DashboardMetrics["costOverTime"] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Cost Over Time</CardTitle>
        <CardDescription>Daily cost and session count</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={costChartConfig} className="h-90 w-full">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => {
                const d = new Date(v);
                return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              }}
            />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(2)}`} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label) =>
                    new Date(label).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                  formatter={(value, name) => (
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-foreground">
                        {name === "cost" ? "Cost" : "Sessions"}
                      </span>
                      <span className="text-muted-foreground">
                        {name === "cost" ? formatCost(value as number) : `${value}`}
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

function ModelUsageChart({ data }: { data: DashboardMetrics["modelUsage"] }) {
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
        <ChartContainer config={modelChartConfig} className="h-90 w-full">
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

function TopProjectsChart({ data }: { data: DashboardMetrics["topProjects"] }) {
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

export function Overview({ metrics }: OverviewProps) {
  return (
    <div className="flex flex-col gap-4">
      <SummaryCards metrics={metrics} />

      <div className="grid gap-4 lg:grid-cols-3">
        <CostOverTimeChart data={metrics.costOverTime} />
        <ModelUsageChart data={metrics.modelUsage} />
      </div>

      <TopProjectsChart data={metrics.topProjects} />

      <div className="grid gap-4 lg:grid-cols-3">
        <ActivityHeatmap data={metrics.costOverTime} />
      </div>
    </div>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from "recharts";
import type { DashboardMetrics } from "./types";
import { DollarSign, MessageSquare, Coins, TrendingUp } from "lucide-react";
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

interface OverviewProps {
  metrics: DashboardMetrics;
}

export function Overview({ metrics }: OverviewProps) {
  const modelPieData = metrics.modelUsage.map((m, i) => ({
    model: m.model,
    count: m.count,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Sessions</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold tabular-nums">
              <MessageSquare className="size-4 text-muted-foreground" />
              {metrics.totalSessions}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total Cost</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold tabular-nums">
              <DollarSign className="size-4 text-muted-foreground" />
              {formatCost(metrics.totalCost)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Avg Cost/Session</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold tabular-nums">
              <TrendingUp className="size-4 text-muted-foreground" />
              {formatCost(metrics.avgCostPerSession)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total Tokens</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold tabular-nums">
              <Coins className="size-4 text-muted-foreground" />
              {formatTokens(metrics.totalTokens)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cost Over Time</CardTitle>
            <CardDescription>Daily cost and session count</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={costChartConfig} className="h-[300px] w-full">
              <AreaChart data={metrics.costOverTime}>
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
                      formatter={(value, name) => (
                        <span className="font-mono">
                          {name === "Cost" ? formatCost(value as number) : value}
                        </span>
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
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Usage</CardTitle>
            <CardDescription>Sessions per model</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={modelChartConfig} className="h-[300px] w-full">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <span className="font-mono">
                          {value} {name === "count" ? "sessions" : ""}
                        </span>
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
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Projects</CardTitle>
          <CardDescription>By session count</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}} className="h-[200px] w-full">
            <BarChart data={metrics.topProjects} layout="vertical">
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
    </div>
  );
}

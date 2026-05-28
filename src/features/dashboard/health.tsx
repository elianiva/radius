
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from "recharts";
import { useState } from "react";
import type { HealthMetrics, ToolMetrics, ExtendedSession } from "./types";
import {
  AlertTriangle,
  Wrench,
  DollarSign,
  Coins,
  Bug,
  Activity,
  TrendingUp,
} from "lucide-react";
import { formatCost, formatTokens, formatDuration } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Link } from "@tanstack/react-router";

interface HealthProps {
  metrics: HealthMetrics;
}

// ─── Summary Bar ───────────────────────────────────────────

function SummaryBar({ metrics }: { metrics: HealthMetrics }) {
  const items = [
    {
      label: "Sessions",
      value: String(metrics.totalSessions),
      icon: Activity,
    },
    {
      label: "Error Rate",
      value: `${(metrics.globalErrorRate * 100).toFixed(1)}%`,
      icon: AlertTriangle,
      highlight: metrics.globalErrorRate > 0.3,
    },
    {
      label: "Tool Calls",
      value: metrics.totalToolCalls.toLocaleString(),
      icon: Wrench,
    },
    {
      label: "Tool Errors",
      value: metrics.totalToolErrors.toLocaleString(),
      icon: Bug,
      highlight: metrics.totalToolErrors > 0,
    },
    {
      label: "Avg Cost/Session",
      value: formatCost(
        metrics.totalSessions > 0
          ? metrics.expensiveSessions.reduce((s, e) => s + e.totalCost, 0) / metrics.totalSessions
          : 0,
      ),
      icon: DollarSign,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {items.map(({ label, value, icon: Icon, highlight }) => (
        <Card key={label}>
          <CardHeader className="p-3">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Icon className="size-3" />
              {label}
            </CardDescription>
            <CardTitle
              className={`text-lg font-bold tabular-nums ${highlight ? "text-destructive" : ""}`}
            >
              {value}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

// ─── Error Trend ───────────────────────────────────────────

const trendConfig = {
  errorRate: {
    label: "Error Rate",
    color: "var(--chart-1)",
  },
  totalSessions: {
    label: "Sessions",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function ErrorTrendChart({ data }: { data: HealthMetrics["errorTrend"] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          Error Rate Over Time
        </CardTitle>
        <CardDescription>Daily error rate trend</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={trendConfig} className="h-60 w-full">
          <LineChart data={data}>
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
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
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
                        {name === "errorRate" ? "Error Rate" : "Sessions"}
                      </span>
                      <span className="text-muted-foreground">
                        {name === "errorRate" ? `${(value as number * 100).toFixed(1)}%` : `${value}`}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="errorRate"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ─── Error Rate by Project ─────────────────────────────────

function ErrorRateByProject({ data }: { data: HealthMetrics["errorRateByProject"] }) {
  const top10 = data.slice(0, 10);
  const barData = top10.map((d) => ({
    name: d.project.length > 20 ? d.project.slice(0, 20) + "…" : d.project,
    errorRate: d.errorRate,
    sessions: d.sessionCount,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-muted-foreground" />
          Error Rate by Project
        </CardTitle>
        <CardDescription>Sessions with tool errors / total</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="h-full min-h-80 w-full">
          <BarChart data={barData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={160}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => (
                    <div className="flex items-center gap-2 font-mono">
                      <span>Error rate: {(value as number * 100).toFixed(1)}%</span>
                      <span className="text-muted-foreground">
                        ({item.payload.sessions} sessions)
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="errorRate" fill="var(--chart-1)" radius={[0, 4, 4, 0]} minPointSize={3} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ─── Most Failing Tools ────────────────────────────────────

function ToolErrorBreakdown({
  mostFailingTools,
  failingToolsByProject,
}: {
  mostFailingTools: ToolMetrics[];
  failingToolsByProject: HealthMetrics["failingToolsByProject"];
}) {
  const [tab, setTab] = useState<"global" | string>("global");

  const tools =
    tab === "global"
      ? mostFailingTools.slice(0, 8)
      : failingToolsByProject.find((p) => p.project === tab)?.tools ?? [];

  const projects = failingToolsByProject.map((p) => p.project);

  const barData = tools.map((t) => ({
    name: t.name.length > 16 ? t.name.slice(0, 16) + "…" : t.name,
    errorCount: t.errorCount,
    callCount: t.callCount,
    errorRate: t.errorRate,
  }));

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="size-4 text-muted-foreground" />
            Failing Tools
          </CardTitle>
          <CardDescription>
            {tab === "global" ? "Across all projects" : `In ${tab}`}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setTab("global")}
            className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
              tab === "global" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
            }`}
          >
            All
          </button>
          {projects.slice(0, 5).map((p) => (
            <button
              key={p}
              onClick={() => setTab(p)}
              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                tab === p ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
              }`}
            >
              {p.length > 10 ? p.slice(0, 10) + "…" : p}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {tools.length === 0 ? (
          <p className="flex h-40 items-center justify-center text-xs text-muted-foreground">
            No tool errors
          </p>
        ) : (
          <ChartContainer config={{}} className="h-60 w-full">
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={130}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => (
                      <div className="flex items-center gap-2 font-mono">
                        <span>{value} errors</span>
                        <span className="text-muted-foreground">
                          ({(item.payload.errorRate * 100).toFixed(1)}% failure rate,{" "}
                          {item.payload.callCount} calls)
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="errorCount" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Top Lists ─────────────────────────────────────────────

function TopSessionsList({
  title,
  description,
  icon: Icon,
  sessions,
  formatValue,
  valueLabel,
}: {
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  sessions: ExtendedSession[];
  formatValue: (s: ExtendedSession) => string;
  valueLabel: string;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-3.5 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {sessions.length === 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
            None found
          </p>
        ) : (
          <div className="space-y-px">
            {sessions.map((s, i) => (
              <Link
                key={s.id}
                to="/sessions/$sessionId"
                params={{ sessionId: s.id }}
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
              >
                <span className="flex size-4 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <span className="line-clamp-1 font-medium">{s.title ?? "(untitled)"}</span>
                  <div className="flex gap-2 text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">
                      {s.projectName}
                    </Badge>
                    <span>{formatDuration(s.duration)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono font-medium tabular-nums text-foreground">
                    {formatValue(s)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{valueLabel}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function HealthDashboard({ metrics }: HealthProps) {
  return (
    <div className="flex flex-col gap-4">
      <SummaryBar metrics={metrics} />

      <div className="grid gap-4 lg:grid-cols-3">
        <ErrorTrendChart data={metrics.errorTrend} />
        <ErrorRateByProject data={metrics.errorRateByProject} />
      </div>

      <ToolErrorBreakdown
        mostFailingTools={metrics.mostFailingTools}
        failingToolsByProject={metrics.failingToolsByProject}
      />

      <div className="flex flex-col gap-4">
        <TopSessionsList
          title="Most Expensive"
          description="Highest cost sessions"
          icon={DollarSign}
          sessions={metrics.expensiveSessions}
          formatValue={(s) => formatCost(s.totalCost)}
          valueLabel="cost"
        />
        <TopSessionsList
          title="Most Tokens"
          description="Highest token usage"
          icon={Coins}
          sessions={metrics.highTokenSessions}
          formatValue={(s) => formatTokens(s.totalTokens)}
          valueLabel="tokens"
        />
        <TopSessionsList
          title="Most Error-Prone"
          description="Most tool errors per session"
          icon={Bug}
          sessions={metrics.errorProneSessions}
          formatValue={(s) => String(s.toolErrorCount)}
          valueLabel="errors"
        />
      </div>
    </div>
  );
}

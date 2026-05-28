import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart } from "recharts";
import { useQuery } from "@tanstack/react-query";
import type { ToolMetrics, ExtendedSession, PaginatedSessions } from "./types";
import { AlertTriangle, Wrench, DollarSign, Coins, Bug, Activity, TrendingUp } from "lucide-react";
import { formatCost, formatTokens, formatDuration } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { DataTable, type Column } from "~/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import {
  getExpensiveSessions,
  getHighTokenSessions,
  getErrorProneSessions,
} from "~/server/rpc/dashboard";
import { StatCardGridSkeleton, ChartCardSkeleton, BarListSkeleton } from "./loading";

interface HealthProps {
  summary?: {
    totalSessions: number;
    totalToolCalls: number;
    totalToolErrors: number;
    globalErrorRate: number;
  };
  errorTrend?: {
    date: string;
    totalSessions: number;
    errorSessions: number;
    errorRate: number;
  }[];
  errorRateByProject?: {
    project: string;
    errorRate: number;
    sessionCount: number;
  }[];
  toolErrors?: {
    mostFailingTools: ToolMetrics[];
    failingToolsByProject: { project: string; tools: ToolMetrics[] }[];
  };
  isLoading?: {
    summary?: boolean;
    errorTrend?: boolean;
    errorRateByProject?: boolean;
    toolErrors?: boolean;
  };
}

function SummaryBar({ summary }: { summary: NonNullable<HealthProps["summary"]> }) {
  const items = [
    {
      label: "Sessions",
      value: String(summary.totalSessions),
      icon: Activity,
    },
    {
      label: "Error Rate",
      value: `${(summary.globalErrorRate * 100).toFixed(1)}%`,
      icon: AlertTriangle,
      highlight: summary.globalErrorRate > 0.3,
    },
    {
      label: "Tool Calls",
      value: summary.totalToolCalls.toLocaleString(),
      icon: Wrench,
    },
    {
      label: "Tool Errors",
      value: summary.totalToolErrors.toLocaleString(),
      icon: Bug,
      highlight: summary.totalToolErrors > 0,
    },
    {
      label: "Total Cost",
      value: "—",
      icon: DollarSign,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {items.map(({ label, value, icon: Icon, highlight }) => (
        <Card key={label}>
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle
              className={`flex items-center gap-2 text-2xl font-bold tabular-nums ${highlight ? "text-destructive" : ""}`}
            >
              <Icon className="size-4 text-muted-foreground" />
              {value}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

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

function ErrorTrendChart({ data }: { data: NonNullable<HealthProps["errorTrend"]> }) {
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
        <ChartContainer config={trendConfig} className="h-90 w-full">
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
                        {name === "errorRate"
                          ? `${((value as number) * 100).toFixed(1)}%`
                          : `${value}`}
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

function ErrorRateByProject({ data }: { data: NonNullable<HealthProps["errorRateByProject"]> }) {
  const filtered = data.filter((d) => d.sessionCount >= 3);
  const top10 = filtered
    .sort((a, b) => b.errorRate * Math.log(b.sessionCount) - a.errorRate * Math.log(a.sessionCount))
    .slice(0, 10);
  const maxRate = top10.reduce((max, d) => Math.max(max, d.errorRate), 0);

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
        <div className="space-y-1">
          {top10.map((d) => {
            const color =
              d.errorRate > 0.3
                ? "var(--chart-1)"
                : d.errorRate > 0.1
                  ? "var(--chart-3)"
                  : "var(--chart-2)";
            return (
              <div key={d.project} className="relative flex items-center gap-3 px-2 py-1.5">
                <span
                  className="absolute inset-y-0 left-0 opacity-10"
                  style={{
                    width: `${(d.errorRate / maxRate) * 100}%`,
                    backgroundColor: color,
                  }}
                />
                <span className="relative flex-1 truncate text-sm">{d.project}</span>
                <span className="relative text-sm tabular-nums" style={{ color }}>
                  {(d.errorRate * 100).toFixed(0)}%
                </span>
                <span className="relative text-xs tabular-nums text-muted-foreground">
                  {d.sessionCount}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ToolErrorBreakdown({
  mostFailingTools,
  failingToolsByProject,
}: {
  mostFailingTools: ToolMetrics[];
  failingToolsByProject: { project: string; tools: ToolMetrics[] }[];
}) {
  const [tab, setTab] = useState<"global" | string>("global");

  const tools =
    tab === "global"
      ? mostFailingTools.slice(0, 8)
      : (failingToolsByProject.find((p) => p.project === tab)?.tools ?? []);

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
            className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${tab === "global" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
              }`}
          >
            All
          </button>
          {projects.slice(0, 5).map((p) => (
            <button
              key={p}
              onClick={() => setTab(p)}
              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${tab === p ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
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
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={130} />
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

const sessionColumns: Column<ExtendedSession>[] = [
  {
    id: "title",
    header: "Title",
    accessor: (s) => <span className="line-clamp-1 font-medium">{s.title ?? "(untitled)"}</span>,
    className: "max-w-56",
  },
  {
    id: "project",
    header: "Project",
    accessor: (s) => (
      <Badge variant="secondary" className="text-[10px]">
        {s.projectName}
      </Badge>
    ),
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
    id: "messages",
    header: "Msgs",
    headerClassName: "text-right",
    className: "text-right font-mono tabular-nums",
    accessor: (s) => String(s.messageCount),
    sortKey: (s) => s.messageCount,
  },
  {
    id: "tokens",
    header: "Tokens",
    headerClassName: "text-right",
    className: "text-right font-mono tabular-nums text-muted-foreground",
    accessor: (s) => formatTokens(s.totalTokens),
    sortKey: (s) => s.totalTokens,
  },
];

const expensiveColumns: Column<ExtendedSession>[] = [
  ...sessionColumns,
  {
    id: "cost",
    header: "Cost",
    headerClassName: "text-right",
    className: "text-right font-mono tabular-nums font-medium",
    accessor: (s) => formatCost(s.totalCost),
    sortKey: (s) => s.totalCost,
  },
];

const highTokenColumns: Column<ExtendedSession>[] = [
  ...sessionColumns,
  {
    id: "tokens-value",
    header: "Tokens",
    headerClassName: "text-right",
    className: "text-right font-mono tabular-nums font-medium",
    accessor: (s) => formatTokens(s.totalTokens),
    sortKey: (s) => s.totalTokens,
  },
];

const errorProneColumns: Column<ExtendedSession>[] = [
  ...sessionColumns,
  {
    id: "errors",
    header: "Errors",
    headerClassName: "text-right",
    className: "text-right font-mono tabular-nums font-medium",
    accessor: (s) =>
      s.toolErrorCount > 0 ? (
        <span className="text-destructive">{s.toolErrorCount}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    sortKey: (s) => s.toolErrorCount,
  },
];

type TabKey = "expensive" | "tokens" | "errors";

interface SessionTableCardProps {
  tab: TabKey;
}

function SessionTableCard({ tab }: SessionTableCardProps) {
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const currentCursor = cursorStack[cursorIndex];

  const queryKey =
    tab === "expensive"
      ? "expensive-sessions"
      : tab === "tokens"
        ? "high-token-sessions"
        : "error-prone-sessions";

  const queryFn = {
    expensive: getExpensiveSessions,
    tokens: getHighTokenSessions,
    errors: getErrorProneSessions,
  }[tab];

  const { data, isFetching } = useQuery<PaginatedSessions>({
    queryKey: [queryKey, currentCursor],
    queryFn: () => queryFn({ data: { cursor: currentCursor } }),
    staleTime: 60_000,
  });

  const columns = {
    expensive: expensiveColumns,
    tokens: highTokenColumns,
    errors: errorProneColumns,
  }[tab];

  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.currentPage ?? 1;
  const items = data?.items ?? [];
  const nextCursor = data?.nextCursor;

  const goNext = () => {
    if (!nextCursor) return;
    const newIndex = cursorIndex + 1;
    const newStack = cursorStack.slice(0, newIndex);
    newStack.push(nextCursor);
    setCursorStack(newStack);
    setCursorIndex(newIndex);
  };

  const goPrev = () => {
    if (cursorIndex <= 0) return;
    setCursorIndex(cursorIndex - 1);
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        page={currentPage}
        totalPages={totalPages}
        onPageChange={(p) => (p > currentPage ? goNext() : goPrev())}
        getRowLink={(s) => `/sessions/${s.id}`}
        loading={isFetching}
      />
    </>
  );
}

const tabConfigs = [
  { key: "expensive" as TabKey, label: "Most Expensive", icon: DollarSign },
  { key: "tokens" as TabKey, label: "Most Tokens", icon: Coins },
  { key: "errors" as TabKey, label: "Most Error-Prone", icon: Bug },
];

function SessionTables() {
  const [activeTab, setActiveTab] = useState<TabKey>("expensive");

  return (
    <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as TabKey)}>
      <Card>
        <CardHeader className="pb-0">
          <TabsList>
            {tabConfigs.map(({ key, label, icon: Icon }) => (
              <TabsTrigger key={key} value={key}>
                <Icon className="size-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </CardHeader>
        <CardContent className="pt-1">
          {tabConfigs.map(({ key }) => (
            <TabsContent key={key} value={key} className="block">
              <SessionTableCard tab={key} />
            </TabsContent>
          ))}
        </CardContent>
      </Card>
    </Tabs>
  );
}

export function HealthDashboard({
  summary,
  errorTrend,
  errorRateByProject,
  toolErrors,
  isLoading = {},
}: HealthProps) {
  return (
    <div className="flex flex-col gap-4">
      {isLoading.summary ? <StatCardGridSkeleton count={5} /> : <SummaryBar summary={summary!} />}

      <div className="grid gap-4 lg:grid-cols-3">
        {isLoading.errorTrend ? (
          <ChartCardSkeleton rows={4} className="lg:col-span-2" />
        ) : (
          <ErrorTrendChart data={errorTrend!} />
        )}
        {isLoading.errorRateByProject ? (
          <Card>
            <CardHeader>
              <CardDescription className="h-3 w-36 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <BarListSkeleton count={5} />
            </CardContent>
          </Card>
        ) : (
          <ErrorRateByProject data={errorRateByProject!} />
        )}
      </div>

      {isLoading.toolErrors ? (
        <ChartCardSkeleton rows={5} />
      ) : (
        <ToolErrorBreakdown
          mostFailingTools={toolErrors!.mostFailingTools}
          failingToolsByProject={toolErrors!.failingToolsByProject}
        />
      )}

      <SessionTables />
    </div>
  );
}

import { useState } from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart, Cell } from "recharts";
import { AlertTriangle, BarChart3, MessageSquare, TrendingUp, Users, Hash } from "lucide-react";
import { SWEAR_WORDS, type SwearSummary, type SwearMention } from "./swear-words";
import { Badge } from "~/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";

interface SwearingDashboardProps {
  data: SwearSummary | undefined;
  isLoading: boolean;
}

const trendConfig = {
  swears: {
    label: "Swear Mentions",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

function SummaryBar({ data }: { data: SwearSummary }) {
  const items = [
    {
      label: "Total Swears",
      value: String(data.totalMentions),
      icon: AlertTriangle,
      highlight: data.totalMentions > 0,
    },
    {
      label: "Swearing Sessions",
      value: String(data.totalSessions),
      icon: MessageSquare,
    },
    {
      label: "Affected Projects",
      value: String(data.uniqueProjects),
      icon: Users,
    },
    {
      label: "Unique Swear Words",
      value: String(data.topWords.length),
      icon: Hash,
    },
    {
      label: "Avg Per Swearing Session",
      value: data.totalSessions > 0 ? (data.totalMentions / data.totalSessions).toFixed(1) : "—",
      icon: BarChart3,
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

function SwearTrendChart({ data }: { data: SwearSummary }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          Swearing Over Time
        </CardTitle>
        <CardDescription>Daily swear mentions</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={trendConfig} className="h-90 w-full">
          <LineChart data={data.swearTrend}>
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
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
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
                  formatter={(value) => (
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-foreground">Swears</span>
                      <span className="text-muted-foreground">{value}</span>
                    </div>
                  )}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="count"
              data={data.swearTrend}
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

function SwearByProject({ data }: { data: SwearSummary }) {
  const top10 = data.swearByProject.slice(0, 10);
  const maxCount = top10.reduce((max, d) => Math.max(max, d.count), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          Swears by Project
        </CardTitle>
        <CardDescription>Total swear mentions per project</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {top10.map((d) => {
            const intensity = d.count / maxCount;
            const color =
              intensity > 0.5
                ? "var(--chart-1)"
                : intensity > 0.25
                  ? "var(--chart-3)"
                  : "var(--chart-2)";
            return (
              <div key={d.project} className="relative flex items-center gap-3 px-2 py-1.5">
                <span
                  className="absolute inset-y-0 left-0 opacity-10"
                  style={{
                    width: `${(d.count / maxCount) * 100}%`,
                    backgroundColor: color,
                  }}
                />
                <span className="relative flex-1 truncate text-sm">{d.project}</span>
                <span className="relative text-sm tabular-nums" style={{ color }}>
                  {d.count}
                </span>
                <span className="relative text-xs tabular-nums text-muted-foreground">
                  {d.sessions} sessions
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TopWords({ data }: { data: SwearSummary }) {
  const barData = data.topWords.map((w) => ({
    word: w.word,
    count: w.count,
  }));
  const maxCount = barData.reduce((max, d) => Math.max(max, d.count), 0);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="size-4 text-muted-foreground" />
          Top Swear Words
        </CardTitle>
        <CardDescription>Most used swear words across sessions</CardDescription>
      </CardHeader>
      <CardContent>
        {barData.length === 0 ? (
          <p className="flex h-40 items-center justify-center text-xs text-muted-foreground">
            Clean as a whistle
          </p>
        ) : (
          <ChartContainer config={{}} className="h-60 w-full">
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="word" tickLine={false} axisLine={false} width={100} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => (
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-medium">"{item.payload.word}"</span>
                        <span className="text-muted-foreground">{value} times</span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {barData.map((entry) => (
                  <Cell
                    key={entry.word}
                    fill={
                      entry.count / maxCount > 0.5
                        ? "var(--chart-1)"
                        : entry.count / maxCount > 0.25
                          ? "var(--chart-3)"
                          : "var(--chart-2)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

const SWEAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function SwearWordList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-muted-foreground" />
          Swear Word Index
        </CardTitle>
        <CardDescription>All tracked swear words</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {SWEAR_WORDS.map((word, i) => (
            <Badge
              key={word}
              variant="secondary"
              className="font-mono text-[10px] lowercase"
              style={{
                backgroundColor: `color-mix(in srgb, ${SWEAR_COLORS[i % SWEAR_COLORS.length]} 10%, transparent)`,
                color: SWEAR_COLORS[i % SWEAR_COLORS.length],
              }}
            >
              {word}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SwearSession({ mention }: { mention: SwearMention }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-start gap-3 rounded px-2 py-2 text-left text-sm transition-colors hover:bg-muted/50"
      >
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {mention.projectName}
            </Badge>
            <span className="truncate text-xs text-muted-foreground">
              {mention.sessionTitle ?? "(untitled)"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{mention.word}</span> in: "
            <span className="italic">{mention.context}</span>"
          </p>
        </div>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Session Details</DialogTitle>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {mention.projectName}
              </Badge>
            </div>
            <p className="font-medium">{mention.sessionTitle ?? "(untitled)"}</p>
            <p>
              Swear word: <span className="font-bold">{mention.word}</span>
            </p>
            <p className="text-muted-foreground">
              Context: <span className="italic">"{mention.context}"</span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecentSwears({ data }: { data: SwearSummary }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" />
          Top Swearing Sessions
        </CardTitle>
        <CardDescription>Most profane sessions</CardDescription>
      </CardHeader>
      <CardContent>
        {data.topSessions.length === 0 ? (
          <p className="flex h-40 items-center justify-center text-xs text-muted-foreground">
            No swearing detected
          </p>
        ) : (
          <div className="divide-y">
            {data.topSessions.map((mention, i) => (
              <SwearSession key={`${mention.sessionId}-${i}`} mention={mention} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SwearingDashboard({ data, isLoading }: SwearingDashboardProps) {
  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <CardDescription className="h-3 w-20 animate-pulse rounded bg-muted" />
                <CardTitle className="h-7 w-24 animate-pulse rounded bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardDescription className="h-3 w-32 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="flex h-90 items-end gap-1.5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 animate-pulse rounded bg-muted"
                    style={{ height: `${20 + Math.random() * 70}px` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="h-3 w-24 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-muted" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SummaryBar data={data} />

      <div className="grid gap-4 lg:grid-cols-3">
        <SwearTrendChart data={data} />
        <SwearByProject data={data} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TopWords data={data} />
        <SwearWordList />
      </div>

      <RecentSwears data={data} />
    </div>
  );
}

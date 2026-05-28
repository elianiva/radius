import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { getSessionsMetrics } from "~/server/rpc/dashboard";
import { useRouter } from "@tanstack/react-router";
import { Clock, MessageSquare, AlertTriangle, Coins, Table2, Grid3x3 } from "lucide-react";
import { formatCost, formatTokens, formatDuration } from "~/lib/utils";

type SortKey = "createdAt" | "duration" | "totalCost" | "messageCount";

export function Sessions() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      }
    >
      <SessionsContent />
    </Suspense>
  );
}

function SessionsContent() {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "table">("table");

  const { data } = useSuspenseQuery({
    queryKey: ["sessions-metrics"],
    queryFn: () => getSessionsMetrics({ data: {} }),
    staleTime: 60_000,
  });

  const sessions = (data?.items ?? []) as Array<{
    id: string;
    title: string | null;
    duration: number;
    createdAt: number;
    totalCost: number;
    totalTokens: number;
    messageCount: number;
    toolErrorCount: number;
    models: string[];
  }>;

  return (
    <div className="flex flex-col gap-4">
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
            No sessions yet. Import sessions from the dashboard.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{sessions.length} sessions</p>
            <Tabs value={view} onValueChange={(v: string) => setView(v as "grid" | "table")}>
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

              <TabsContent value="table">
                <SessionTable sessions={sessions} router={router} />
              </TabsContent>

              <TabsContent value="grid">
                <SessionGrid sessions={sessions} router={router} />
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
    </div>
  );
}

function SessionTable({
  sessions,
  router,
}: {
  sessions: Array<{
    id: string;
    title: string | null;
    duration: number;
    createdAt: number;
    totalCost: number;
    totalTokens: number;
    messageCount: number;
    toolErrorCount: number;
    models: string[];
  }>;
  router: ReturnType<typeof useRouter>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...sessions];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp = va > vb ? 1 : va < vb ? -1 : 0;
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
      {sortKey === sort && (
        <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
      )}
    </th>
  );

  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Title
            </th>
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
          {sorted.map((session) => (
            <tr
              key={session.id}
              className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
              onClick={() =>
                router.navigate({
                  to: "/sessions/$sessionId",
                  params: { sessionId: session.id },
                })
              }
            >
              <td className="max-w-48 truncate px-3 py-2 font-medium">
                {session.title ?? "(untitled)"}
              </td>
              <td className="px-3 py-2 font-mono text-muted-foreground">
                {new Date(session.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </td>
              <td className="px-3 py-2 font-mono">{formatDuration(session.duration)}</td>
              <td className="px-3 py-2 font-mono">{formatCost(session.totalCost)}</td>
              <td className="px-3 py-2 font-mono">{session.messageCount}</td>
              <td className="px-3 py-2 font-mono text-muted-foreground">
                {formatTokens(session.totalTokens)}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {session.models.map((m) => (
                    <Badge key={m} variant="secondary" className="text-[10px]">
                      {m}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2">
                {session.toolErrorCount > 0 ? (
                  <span className="font-mono text-destructive">{session.toolErrorCount}</span>
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

function SessionGrid({
  sessions,
  router,
}: {
  sessions: Array<{
    id: string;
    title: string | null;
    duration: number;
    createdAt: number;
    totalCost: number;
    totalTokens: number;
    messageCount: number;
    toolErrorCount: number;
    models: string[];
  }>;
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
            <CardTitle className="line-clamp-1 text-sm">
              {session.title ?? "(untitled)"}
            </CardTitle>
            <CardDescription className="flex flex-wrap gap-1">
              {session.models.map((m) => (
                <Badge key={m} variant="secondary" className="text-[10px]">
                  {m}
                </Badge>
              ))}
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

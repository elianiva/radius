import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { getSessionsMetrics } from "~/server/rpc/dashboard";
import { useRouter } from "@tanstack/react-router";
import { Clock, MessageSquare, AlertTriangle, Coins } from "lucide-react";
import { formatCost, formatTokens, formatDuration } from "~/lib/utils";

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
      <SessionsList />
    </Suspense>
  );
}

function SessionsList() {
  const router = useRouter();

  const { data } = useSuspenseQuery({
    queryKey: ["sessions-metrics"],
    queryFn: () => getSessionsMetrics({ data: {} }),
    staleTime: 60_000,
  });

  const sessions = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
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

      {sessions.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
            No sessions yet. Import sessions from the dashboard.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

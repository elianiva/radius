import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Loader2, Sparkles, BarChart3, Folder, List } from "lucide-react";
import { importPiSessions } from "~/server/rpc/sessions";
import { getDashboardMetrics } from "~/server/rpc/dashboard";
import { Overview } from "~/features/dashboard/overview";
import { Projects } from "~/features/dashboard/projects";
import { Sessions } from "~/features/dashboard/sessions";
import type { IngestProgress } from "~/features/sessions/adapters/pi";

export const Route = createFileRoute("/")({
  component: () => (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col gap-6 p-8">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </main>
      }
    >
      <Home />
    </Suspense>
  ),
});

function Digest({ progress }: { progress: IngestProgress }) {
  switch (progress.stage) {
    case "finding-sessions":
      return (
        <span className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Finding sessions…
        </span>
      );
    case "importing-session":
      return (
        <span className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Importing {progress.sessionIndex}/{progress.totalSessions}: {progress.project}
        </span>
      );
    case "done":
      return (
        <span className="flex items-center gap-2">
          <Sparkles className="size-4" />
          Imported {progress.result.sessions} sessions
        </span>
      );
  }
}

function Home() {
  const queryClient = useQueryClient();
  const [ingestProgress, setIngestProgress] = useState<IngestProgress | null>(null);
  const [activeTab, setActiveTab] = useState("0");

  const { data: metrics } = useSuspenseQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: () => getDashboardMetrics(),
    staleTime: 60_000,
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const stream = await importPiSessions();
      for await (const progress of stream) {
        setIngestProgress(progress);
      }
    },
    onSuccess: () => {
      setIngestProgress(null);
      void queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
  });

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

        <Button disabled={importMutation.isPending} onClick={() => importMutation.mutate()}>
          {importMutation.isPending ? "Importing…" : "Import Pi Sessions"}
        </Button>
      </div>

      {importMutation.isPending && ingestProgress ? (
        <div className="flex items-center justify-center rounded border py-16">
          <Digest progress={ingestProgress} />
        </div>
      ) : metrics.totalSessions === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded border py-16">
          <p className="text-muted-foreground">No sessions yet</p>
          <Button onClick={() => importMutation.mutate()}>Import Pi Sessions</Button>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)}>
          <TabsList variant="line">
            <TabsTrigger value="0">
              <BarChart3 className="size-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="1">
              <Folder className="size-3.5" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="2">
              <List className="size-3.5" />
              Sessions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="0">
            <Overview metrics={metrics} />
          </TabsContent>

          <TabsContent value="1">
            <Projects projects={metrics.projects} />
          </TabsContent>

          <TabsContent value="2">
            <Sessions />
          </TabsContent>
        </Tabs>
      )}
    </main>
  );
}

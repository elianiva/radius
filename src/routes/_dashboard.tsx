import { Outlet, Link, createFileRoute } from "@tanstack/react-router";
import { buttonVariants } from "~/components/ui/button";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { Button } from "~/components/ui/button";
import { Loader2, Sparkles, BarChart3, Folder, List, HeartPulse } from "lucide-react";
import { importPiSessions } from "~/server/rpc/sessions";
import { getDashboardMetrics } from "~/server/rpc/dashboard";
import type { IngestProgress } from "~/features/sessions/adapters/pi";

export const Route = createFileRoute("/_dashboard")({
  component: DashboardLayout,
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

function DashboardLayout() {
  const queryClient = useQueryClient();
  const [ingestProgress, setIngestProgress] = useState<IngestProgress | null>(null);

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

  const links = [
    { to: "/overview", label: "Overview", icon: BarChart3 },
    { to: "/projects", label: "Projects", icon: Folder },
    { to: "/sessions", label: "Sessions", icon: List },
    { to: "/health", label: "Health", icon: HeartPulse },
  ] as const;

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/overview" className="text-2xl font-bold tracking-tight">
          Dashboard
        </Link>

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
        <>
          <nav className="flex gap-2">
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true }}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
                activeProps={{ className: buttonVariants({ variant: "default", size: "sm" }) }}
              >
                <Icon className="size-3.5" />
                {label}
              </Link>
            ))}
          </nav>
          <Suspense fallback={<div>Loading…</div>}>
            <Outlet />
          </Suspense>
        </>
      )}
    </main>
  );
}

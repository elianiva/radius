import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { Session } from "~/db/schema";
import type { IngestProgress } from "~/features/sessions/adapters/pi";
import { importPiSessions, getSessionsList } from "~/server/rpc/sessions";
import { Button } from "~/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });

const columnHelper = createColumnHelper<Session>();

const columns = [
  columnHelper.accessor("title", {
    header: "Title",
    cell: (info) => info.getValue() ?? "(untitled)",
  }),
  columnHelper.accessor("agent", {
    header: "Agent",
    cell: (info) => info.getValue() ?? "—",
  }),
  columnHelper.accessor("directory", {
    header: "Directory",
    cell: (info) => {
      const dir = info.getValue();
      return dir.split("/").pop() ?? dir;
    },
  }),
  columnHelper.accessor("createdAt", {
    header: "Created",
    cell: (info) => new Date(info.getValue()).toLocaleDateString(),
  }),
];

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
  const [pages, setPages] = useState<Session[][]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [ingestProgress, setIngestProgress] = useState<IngestProgress | null>(null);

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["sessions", cursor],
    queryFn: () =>
      getSessionsList({ data: { cursor: cursor ?? undefined } }).then((result) => {
        setPages((prev) => (cursor ? [...prev, result.items] : [result.items]));
        return result;
      }),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  });

  const sessions = useMemo(() => pages.flat(), [pages]);
  const nextCursor = data?.cursor ?? null;

  const importMutation = useMutation({
    mutationFn: async () => {
      const stream = await importPiSessions();
      for await (const progress of stream) {
        setIngestProgress(progress);
      }
    },
    onSuccess: () => {
      setIngestProgress(null);
      setCursor(null);
      setPages([]);
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });

  const router = useRouter();

  const table = useReactTable({
    data: sessions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>

        <Button disabled={importMutation.isPending} onClick={() => importMutation.mutate()}>
          {importMutation.isPending ? "Importing…" : "Import Pi Sessions"}
        </Button>
      </div>

      {importMutation.isPending && ingestProgress ? (
        <div className="flex items-center justify-center rounded border py-16">
          <Digest progress={ingestProgress} />
        </div>
      ) : isLoading && sessions.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          Loading sessions…
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b bg-muted/50">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-2 text-left font-medium text-muted-foreground"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                    onClick={() =>
                      router.navigate({
                        to: "/sessions/$sessionId",
                        params: { sessionId: row.original.id },
                      })
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No sessions yet. Click "Import Pi Sessions" to load your sessions.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                disabled={isPlaceholderData}
                onClick={() => setCursor(nextCursor)}
              >
                {isPlaceholderData ? "Loading…" : "Load More"}
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

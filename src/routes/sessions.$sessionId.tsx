import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { Suspense, useMemo } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { getSessionEvents } from "~/server/rpc/sessions";
import { ArrowLeft } from "lucide-react";
import type { TimelineEvent } from "~/features/sessions/services/session";

export const Route = createFileRoute("/sessions/$sessionId")({
  component: SessionDetail,
});

interface ParsedEvent extends TimelineEvent {
  parsed: Record<string, unknown>;
}

function EventsTable({ sessionId }: { sessionId: string }) {
  const { data: events } = useSuspenseQuery({
    queryKey: ["session-events", sessionId],
    queryFn: () => getSessionEvents({ data: { sessionId } }),
  });

  const { rows, columns } = useMemo(() => {
    if (!events || events.length === 0)
      return { rows: [], columns: [] as ColumnDef<ParsedEvent>[] };

    const allKeys = new Set<string>();
    const parsed: ParsedEvent[] = events.map((ev) => {
      let parsedData: Record<string, unknown> = {};
      try {
        parsedData = JSON.parse(ev.data) as Record<string, unknown>;
      } catch {
        parsedData = { raw: ev.data };
      }
      for (const key of Object.keys(parsedData)) {
        allKeys.add(key);
      }
      return { ...ev, parsed: parsedData };
    });

    const sortedKeys = Array.from(allKeys).sort();
    const ch = createColumnHelper<ParsedEvent>();

    const columns: ColumnDef<ParsedEvent>[] = [
      ch.accessor("id", {
        header: "ID",
        cell: (info) => {
          const id = info.getValue();
          return (
            <span className="font-mono text-xs">{id.length > 12 ? id.slice(0, 8) + "…" : id}</span>
          );
        },
      }),
      ch.accessor("eventType", {
        header: "Type",
      }),
      ch.accessor("createdAt", {
        header: "Created",
        cell: (info) => new Date(info.getValue()).toLocaleString(),
      }),
      ...sortedKeys.map((key) =>
        ch.accessor(
          (row) => {
            const val = row.parsed[key];
            if (val === null || val === undefined) return "";
            if (typeof val === "string") return val;
            return JSON.stringify(val);
          },
          {
            id: `data_${key}`,
            header: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
            cell: (info) => {
              const val = info.row.original.parsed[key];
              if (Array.isArray(val)) {
                const text = val
                  .filter(
                    (c): c is { type: string; text?: string } =>
                      typeof c === "object" && c !== null,
                  )
                  .map((c) => (c.type === "text" ? (c.text ?? "") : `[${c.type}]`))
                  .filter(Boolean)
                  .join(" ");
                return (
                  <span
                    className="line-clamp-2 break-all text-xs"
                    title={text || JSON.stringify(val)}
                  >
                    {text || JSON.stringify(val)}
                  </span>
                );
              }
              if (typeof val === "string")
                return (
                  <span className="line-clamp-2 break-all text-xs" title={val}>
                    {val}
                  </span>
                );
              const str = JSON.stringify(val);
              return (
                <code className="line-clamp-2 break-all text-xs block" title={str}>
                  {str}
                </code>
              );
            },
          },
        ),
      ),
    ];

    return { rows: parsed, columns };
  }, [events]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        No events found for this session.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b bg-muted/50">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="w-64 px-4 py-2 text-left font-medium text-muted-foreground"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="w-64 min-w-0 overflow-hidden px-4 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionDetail() {
  const { sessionId } = Route.useParams();

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted/30"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Session Events</h1>
        <span className="text-sm text-muted-foreground">{sessionId}</span>
      </div>

      <Suspense
        fallback={
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        }
      >
        <EventsTable sessionId={sessionId} />
      </Suspense>
    </main>
  );
}

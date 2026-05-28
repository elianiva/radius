import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { getSessionEvents } from "~/server/rpc/sessions";
import { ArrowLeft } from "lucide-react";
import type { TimelineEvent } from "~/features/sessions/services/session";

export const Route = createFileRoute("/sessions/$sessionId")({
  component: SessionDetail,
});

function EventRow({ event }: { event: TimelineEvent }) {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(event.data) as Record<string, unknown>;
  } catch {
    parsed = { raw: event.data };
  }

  const knownKeys = ["role", "model", "stopReason", "usage", "content", "toolName", "isError"];
  const known: { key: string; value: string }[] = [];
  const extra: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(parsed)) {
    if (knownKeys.includes(k)) {
      known.push({
        key: k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
        value: typeof v === "string" ? v : JSON.stringify(v),
      });
    } else {
      extra[k] = v;
    }
  }

  const contentPreview = Array.isArray(parsed.content)
    ? (parsed.content as { type: string; text?: string }[])
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text!)
        .join(" ")
        .slice(0, 120)
    : typeof parsed.content === "string"
      ? parsed.content.slice(0, 120)
      : null;

  return (
    <details className="group border-b last:border-0">
      <summary className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {new Date(event.createdAt).toLocaleTimeString()}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
            {event.eventType}
          </span>
        </span>
        {contentPreview && (
          <span className="line-clamp-1 flex-1 text-xs text-muted-foreground">
            {contentPreview}
          </span>
        )}
      </summary>
      <div className="border-t px-4 py-3">
        <div className="mb-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">ID</span>
          <span className="font-mono">{event.id}</span>
          {known.map(({ key }) => (
            <span key={key} className="text-muted-foreground">
              {key}
            </span>
          ))}
          {known.map(({ key, value }) => (
            <span key={key} className="break-all font-mono">
              {value}
            </span>
          ))}
        </div>
        {Object.keys(extra).length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Raw data
            </summary>
            <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(extra, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </details>
  );
}

function EventsList({ sessionId }: { sessionId: string }) {
  const { data: events } = useSuspenseQuery({
    queryKey: ["session-events", sessionId],
    queryFn: () => getSessionEvents({ data: { sessionId } }),
  });

  if (!events || events.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        No events found for this session.
      </div>
    );
  }

  return (
    <div className="divide-y rounded border">
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </div>
  );
}

function SessionDetail() {
  const { sessionId } = Route.useParams();

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <div className="flex items-center gap-4">
        <Link
          to="/sessions"
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
        <EventsList sessionId={sessionId} />
      </Suspense>
    </main>
  );
}

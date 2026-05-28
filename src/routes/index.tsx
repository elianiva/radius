import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [count, setCount] = useState(0);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-4xl font-bold tracking-tight">Counter</h1>

        <p className="text-6xl font-mono tabular-nums">{count}</p>

        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={() => setCount((c) => c - 1)}>
            −
          </Button>
          <Button size="icon" variant="default" onClick={() => setCount((c) => c + 1)}>
            +
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={() => setCount(0)}>
          Reset
        </Button>
      </div>
    </main>
  );
}

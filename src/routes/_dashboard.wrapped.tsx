import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getWrappedData } from "~/server/rpc/wrapped";
import { Wrapped } from "~/features/wrapped/wrapped";

export const Route = createFileRoute("/_dashboard/wrapped")({
  component: WrappedRoute,
});

function WrappedRoute() {
  const [year, setYear] = useState<number | undefined>(undefined);

  const { data } = useQuery({
    queryKey: ["wrapped-data", year],
    queryFn: () => getWrappedData({ data: { year } }),
    staleTime: 60_000,
  });

  if (!data) {
    return (
      <div className="flex h-[calc(100vh-5rem)] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <Wrapped data={data} year={year} onYearChange={setYear} />;
}

import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-none bg-muted before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/5 before:to-transparent",
        className,
      )}
      style={style}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <Skeleton className="mb-1 h-2.5 w-20" />
        <Shimmer className="h-7 w-24" />
      </CardHeader>
    </Card>
  );
}

export function StatCardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Loading stats">
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartCardSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)} aria-hidden="true">
      <CardHeader>
        <Skeleton className="mb-1 h-3 w-28" />
        <Skeleton className="h-2.5 w-40" />
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1.5">
          {Array.from({ length: rows * 6 }, (_, i) => (
            <Shimmer
              key={i}
              className="flex-1"
              style={
                {
                  height: `${20 + Math.sin(i * 1.2) * 30 + Math.cos(i * 0.7) * 15}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("h-full w-full", className)} aria-hidden="true">
      <div className="flex h-full items-end gap-1.5 px-1">
        {Array.from({ length: 24 }, (_, i) => (
          <Shimmer
            key={i}
            className="flex-1"
            style={
              {
                height: `${20 + Math.sin(i * 1.2) * 40 + Math.cos(i * 0.7) * 15}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

export function PieChartSkeleton() {
  return (
    <div className="flex items-center justify-center" aria-hidden="true">
      <Shimmer className="size-40 rounded-none" />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto rounded border" aria-label="Loading table">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            {Array.from({ length: cols }, (_, i) => (
              <th key={i} className="px-3 py-2">
                <Skeleton className="h-2.5 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i} className="border-b last:border-0">
              {Array.from({ length: cols }, (_, j) => (
                <td key={j} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {j === cols - 1 ? (
                      <Skeleton className="ml-auto h-2.5 w-8" />
                    ) : (
                      <>
                        {j === 0 && <div className="size-5 rounded bg-muted" />}
                        <Skeleton
                          className={cn(
                            "h-2.5",
                            j === 0 ? "w-20" : j === cols - 2 ? "w-12" : "w-14",
                          )}
                        />
                      </>
                    )}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shimmer className="size-4 rounded-none" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <div className="mt-1 flex gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-14" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function BarListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-6" />
          <Shimmer
            className="h-3.5 flex-1"
            style={{ width: `${50 + Math.random() * 45}%` } as React.CSSProperties}
          />
        </div>
      ))}
    </div>
  );
}

export function HeatmapSkeleton() {
  return (
    <div className="flex flex-col gap-1" aria-hidden="true">
      <div className="flex justify-end gap-1">
        {Array.from({ length: 53 }, (_, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {Array.from({ length: 7 }, (_, j) => (
              <Shimmer key={j} className="size-2.5 rounded-none" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewLoading() {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <StatCardGridSkeleton count={4} />

      {/* Badge row */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-28" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCardSkeleton rows={5} className="lg:col-span-2" />
        <Card aria-hidden="true">
          <CardHeader>
            <Skeleton className="mb-1 h-3 w-24" />
            <Skeleton className="h-2.5 w-36" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <Shimmer className="size-32 rounded-none" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="mb-1 h-3 w-24" />
          <Skeleton className="h-2.5 w-40" />
        </CardHeader>
        <CardContent>
          <ChartSkeleton className="h-50" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCardSkeleton rows={3} />
        <Card aria-hidden="true">
          <CardHeader>
            <Skeleton className="mb-1 h-3 w-28" />
            <Skeleton className="h-2.5 w-36" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between">
                    <Skeleton className="h-2.5 w-20" />
                    <Skeleton className="h-2.5 w-12" />
                  </div>
                  <Shimmer className="h-2 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="mb-1 h-3 w-16" />
          <Skeleton className="h-2.5 w-40" />
        </CardHeader>
        <CardContent>
          <HeatmapSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}

export function ProjectsLoading() {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="mb-1 h-3 w-32" />
          <Skeleton className="h-2.5 w-40" />
        </CardHeader>
        <CardContent>
          <ChartSkeleton className="h-[300px]" />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function HealthOverviewLoading() {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <StatCardGridSkeleton count={5} />

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCardSkeleton rows={4} className="lg:col-span-2" />
        <Card aria-hidden="true">
          <CardHeader>
            <Skeleton className="mb-1 h-3 w-36" />
            <Skeleton className="h-2.5 w-32" />
          </CardHeader>
          <CardContent>
            <BarListSkeleton count={5} />
          </CardContent>
        </Card>
      </div>

      <ChartCardSkeleton rows={5} />

      <Card aria-hidden="true">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={4} cols={6} />
        </CardContent>
      </Card>
    </div>
  );
}

export function SessionsTableLoading({ rows = 8 }: { rows?: number }) {
  return (
    <div className="animate-in fade-in duration-300">
      <TableSkeleton rows={rows} cols={8} />
    </div>
  );
}

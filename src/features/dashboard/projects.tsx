import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ProjectMetrics } from "./types";
import { Badge } from "~/components/ui/badge";
import { Folder } from "lucide-react";
import { formatCost, formatDuration } from "~/lib/utils";

const chartConfig = {
  sessions: {
    label: "Sessions",
    color: "var(--chart-1)",
  },
  cost: {
    label: "Cost ($)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

interface ProjectsProps {
  projects: ProjectMetrics[];
  onSelectProject?: (projectId: string) => void;
}

export function Projects({ projects, onSelectProject }: ProjectsProps) {
  const sorted = [...projects].sort((a, b) => b.sessionCount - a.sessionCount);

  const barData = sorted.slice(0, 10).map((p) => ({
    name: p.name.length > 20 ? p.name.slice(0, 20) + "…" : p.name,
    sessions: p.sessionCount,
    cost: p.totalCost,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Projects Overview</CardTitle>
          <CardDescription>Session count and cost by project</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <span className="font-mono">
                        {name === "Cost ($)" ? formatCost(value as number) : value}
                      </span>
                    )}
                  />
                }
              />
              <Bar dataKey="sessions" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((project) => (
          <Card
            key={project.id}
            className={onSelectProject ? "cursor-pointer transition-colors hover:bg-muted/50" : ""}
            onClick={() => onSelectProject?.(project.id)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="size-4 text-muted-foreground" />
                {project.name}
              </CardTitle>
              <CardDescription className="flex gap-2">
                <Badge variant="secondary">{project.sessionCount} sessions</Badge>
                <Badge variant="outline">{formatCost(project.totalCost)}</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg messages/session</span>
                <span className="font-mono">{project.avgMessagesPerSession.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg duration</span>
                <span className="font-mono">{formatDuration(project.avgDuration)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Error rate</span>
                <span className="font-mono">{(project.errorRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Most used model</span>
                <Badge variant="secondary" className="text-[10px]">
                  {project.mostUsedModel}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

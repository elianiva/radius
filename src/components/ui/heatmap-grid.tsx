import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

export type HeatmapCell = {
  date: string;
  dateLabel: string;
  intensity: number; // 0..4
  tooltip: string;
};

const INTENSITY_COLORS = [
  "bg-pink-100/40",
  "bg-pink-200/70",
  "bg-pink-300/80",
  "bg-pink-400/80",
  "bg-pink-500",
];

function buildGrid(weeks: { days: (HeatmapCell | null)[] }[]) {
  const WEEKS = 53;
  const cols: (HeatmapCell | null)[][] = Array.from({ length: WEEKS }, () => Array(7).fill(null));
  if (!weeks.length) return cols;
  const allDays = weeks.flatMap((w) => w.days.filter((d): d is HeatmapCell => d !== null));
  if (!allDays.length) return cols;
  const last = allDays[allDays.length - 1];
  const endDate = new Date(last.date + "T00:00:00Z");
  const endSundayMs = endDate.getTime() - endDate.getUTCDay() * 86400000;
  for (const d of allDays) {
    const dt = new Date(d.date + "T00:00:00Z");
    const dow = dt.getUTCDay();
    const thisSundayMs = dt.getTime() - dow * 86400000;
    const weeksAgo = Math.round((endSundayMs - thisSundayMs) / (7 * 86400000));
    const col = WEEKS - 1 - weeksAgo;
    if (col >= 0 && col < WEEKS) cols[col][dow] = d;
  }
  return cols;
}

function getMonthLabels(cols: (HeatmapCell | null)[][]): string[] {
  type Span = { start: number; end: number; month: string; year: number; count: number };
  const spans: Span[] = [];
  let cur: Span | null = null;

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const cells = col.filter(Boolean) as HeatmapCell[];
    if (!cells.length) {
      if (cur) spans.push(cur);
      cur = null;
      continue;
    }

    const counts = new Map<string, { count: number; year: number }>();
    for (const c of cells) {
      const d = new Date(c.date + "T00:00:00Z");
      const key = d.toLocaleDateString("en-US", { month: "short" }).toLowerCase();
      const existing = counts.get(key) ?? { count: 0, year: d.getFullYear() };
      existing.count++;
      existing.year = d.getFullYear();
      counts.set(key, existing);
    }

    let best = "";
    let bestCount = 0;
    let bestYear = 0;
    for (const [month, info] of counts) {
      if (info.count > bestCount) {
        best = month;
        bestCount = info.count;
        bestYear = info.year;
      }
    }

    if (cur && cur.month === best && cur.year === bestYear) {
      cur.end = i;
      cur.count += bestCount;
    } else {
      if (cur) spans.push(cur);
      cur = { start: i, end: i, month: best, year: bestYear, count: bestCount };
    }
  }
  if (cur) spans.push(cur);

  const bestSpanPerMonth = new Map<string, Span>();
  for (const s of spans) {
    const existing = bestSpanPerMonth.get(s.month);
    if (!existing || s.count > existing.count) {
      bestSpanPerMonth.set(s.month, s);
    }
  }

  const labels: string[] = Array.from({ length: cols.length });
  for (const s of spans) {
    if (bestSpanPerMonth.get(s.month) === s) {
      labels[s.start] = s.month;
    }
  }

  return labels;
}

interface Props {
  weeks: { days: (HeatmapCell | null)[] }[];
  legendLabel?: string;
  emptyLabel?: string;
  title?: string;
  extra?: ReactNode;
}

export function HeatmapGrid({
  weeks,
  legendLabel,
  emptyLabel = "No activity data.",
  title,
}: Props) {
  const allDays = weeks.flatMap((w) => w.days.filter((d): d is HeatmapCell => d !== null));
  if (!allDays.length) {
    return <p className="pt-2 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const cols = buildGrid(weeks);
  const monthLabels = getMonthLabels(cols);

  return (
    <div className="w-full">
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}

      <div className="flex gap-0.75 mb-1 text-[10px] text-muted-foreground/50 uppercase tracking-wider">
        {monthLabels.map((label, i) => (
          <div key={`${label}-${i}`} className="flex-1 text-center" title={label || undefined}>
            {label}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto w-full">
        <div className="flex gap-0.75 w-full">
          {cols.map((col, colIdx) => {
            const firstCell = col.find(Boolean);
            const weekKey = firstCell?.date ?? `empty-${colIdx}`;
            return (
              <div key={weekKey} className="flex flex-col gap-0.75 flex-1 min-w-0">
                {col.map((d, rowIdx) => {
                  if (!d) {
                    return (
                      <div
                        key={`empty-${weekKey}-${rowIdx}`}
                        className="bg-muted/20"
                        style={{ aspectRatio: "1" }}
                      />
                    );
                  }
                  const colorIdx = Math.min(4, Math.max(0, d.intensity));
                  return (
                    <Tooltip key={d.date}>
                      <TooltipTrigger
                        render={(props) => (
                          <div
                            {...props}
                            style={{ ...props.style, aspectRatio: "1" }}
                            className={[
                              props.className ?? "",
                              "transition-colors duration-150",
                              INTENSITY_COLORS[colorIdx],
                              colorIdx > 0 && "hover:opacity-80",
                            ].join(" ")}
                          />
                        )}
                      />
                      <TooltipContent side="top" align="center">
                        {d.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1 mt-3">
        <span className="text-xs text-muted-foreground/50">{legendLabel ?? "less"}</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div key={level} className={["size-3", INTENSITY_COLORS[level]].join(" ")} />
        ))}
        <span className="text-xs text-muted-foreground/50">more</span>
      </div>
    </div>
  );
}

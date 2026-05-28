import { formatCost } from "~/lib/utils";
import type { HeatmapCell } from "~/components/ui/heatmap-grid";

export interface HeatmapDay {
  readonly date: string;
  readonly sessionCount: number;
  readonly cost: number;
}

export interface HeatmapWeek {
  readonly days: (HeatmapCell | null)[];
}

export function buildHeatmapWeeks(data: readonly HeatmapDay[]): HeatmapWeek[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const oneYearAgo = new Date(today);
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);

  const dayMap = new Map<string, HeatmapDay>();
  for (const d of data) {
    dayMap.set(d.date, d);
  }

  const allDays: { date: string; dateLabel: string; sessionCount: number; cost: number }[] = [];
  const cursor = new Date(oneYearAgo);
  while (cursor <= today) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const dayData = dayMap.get(dateStr);
    allDays.push({
      date: dateStr,
      dateLabel: cursor.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      sessionCount: dayData?.sessionCount ?? 0,
      cost: dayData?.cost ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const values = allDays.map((d) => d.sessionCount).filter((v) => v > 0);
  const max = values.length > 0 ? Math.max(...values) : 0;

  const firstDay = new Date(allDays[0].date + "T00:00:00Z");
  const dayOfWeek = firstDay.getUTCDay();
  const weeks: HeatmapWeek[] = [];
  let currentWeekDays: (HeatmapCell | null)[] = [];

  for (let i = 0; i < dayOfWeek; i++) {
    currentWeekDays.push(null);
  }

  for (const d of allDays) {
    const intensity =
      max > 0
        ? Math.min(4, Math.ceil((d.sessionCount / max) * 4) || (d.sessionCount > 0 ? 1 : 0))
        : 0;
    currentWeekDays.push({
      date: d.date,
      dateLabel: d.dateLabel,
      intensity,
      tooltip:
        d.sessionCount > 0
          ? `${d.sessionCount} session${d.sessionCount !== 1 ? "s" : ""} — $${formatCost(d.cost)} on ${d.dateLabel}`
          : `No activity on ${d.dateLabel}`,
    });

    if (currentWeekDays.length === 7) {
      weeks.push({ days: currentWeekDays });
      currentWeekDays = [];
    }
  }

  if (currentWeekDays.length > 0) {
    while (currentWeekDays.length < 7) {
      currentWeekDays.push(null);
    }
    weeks.push({ days: currentWeekDays });
  }

  return weeks;
}

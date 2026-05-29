import { motion } from "motion/react";

interface Props {
  breakdown: { name: string; sessionCount: number; cost: number }[];
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function ProjectBreakdownSlide({ breakdown }: Props) {
  const maxCount = Math.max(...breakdown.map((p) => p.sessionCount), 1);
  const top5 = breakdown.slice(0, 5);
  const others = breakdown.slice(5);
  const otherSessions = others.reduce((s, p) => s + p.sessionCount, 0);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-3xl font-bold tracking-tight"
      >
        Where You Spent Your Time
      </motion.h2>

      <div className="flex w-full max-w-md flex-col gap-3">
        {top5.map((proj, i) => (
          <motion.div
            key={proj.name}
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 * i + 0.3, duration: 0.4 }}
            className="flex items-center gap-3"
          >
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="flex-1 truncate text-sm">{proj.name}</span>
            <div className="h-3 w-32 overflow-hidden rounded-sm bg-muted sm:w-48">
              <div
                className="h-full rounded-sm transition-all"
                style={{
                  width: `${(proj.sessionCount / maxCount) * 100}%`,
                  backgroundColor: COLORS[i % COLORS.length],
                  opacity: 0.7,
                }}
              />
            </div>
            <span className="w-8 text-right text-sm font-bold tabular-nums">
              {proj.sessionCount}
            </span>
          </motion.div>
        ))}
        {others.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8, duration: 0.4 }}
            className="flex items-center gap-3 text-xs text-muted-foreground"
          >
            <span className="size-3 shrink-0 rounded-sm bg-muted-foreground/30" />
            <span className="flex-1">+{others.length} more projects</span>
            <span className="w-8 text-right tabular-nums">{otherSessions}</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

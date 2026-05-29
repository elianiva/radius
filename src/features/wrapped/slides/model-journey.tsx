import { motion } from "motion/react";

interface Props {
  journey: { month: string; model: string; count: number }[];
}

export function ModelJourneySlide({ journey }: Props) {
  const months = [...new Set(journey.map((j) => j.month))].sort();
  const models = [...new Set(journey.map((j) => j.model))];
  const maxCount = Math.max(...journey.map((j) => j.count), 1);

  const colors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-3xl font-bold tracking-tight"
      >
        Model Evolution
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-sm text-muted-foreground"
      >
        How your model preferences changed over time
      </motion.p>

      <div className="flex w-full max-w-lg flex-col gap-2">
        {months.map((month, mi) => (
          <motion.div
            key={month}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 * mi + 0.3, duration: 0.4 }}
            className="flex items-center gap-3"
          >
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {month}
            </span>
            <div className="flex h-5 flex-1 gap-0.5 overflow-hidden rounded-sm">
              {models.map((model, ci) => {
                const entry = journey.find((j) => j.month === month && j.model === model);
                const width = entry ? (entry.count / maxCount) * 100 : 0;
                if (width < 1) return null;
                return (
                  <div
                    key={model}
                    className="h-full transition-all"
                    style={{ width: `${width}%`, backgroundColor: colors[ci % colors.length] }}
                  />
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="flex flex-wrap justify-center gap-3"
      >
        {models.map((model, ci) => (
          <div key={model} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2 rounded-sm"
              style={{ backgroundColor: colors[ci % colors.length] }}
            />
            {model}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

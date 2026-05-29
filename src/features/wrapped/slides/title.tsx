import { motion } from "motion/react";
import type { WrappedData } from "../services/wrapped";
import { Sparkles } from "lucide-react";

interface Props {
  data: WrappedData;
  year: number;
  onYearChange: (year: number | undefined) => void;
}

export function TitleSlide({ data, year, onYearChange }: Props) {
  const label = year ? `Your ${year} in Sessions` : "All Your Sessions, Reimagined";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        whileInView={{ scale: 1, rotate: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <Sparkles className="size-16 text-primary" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="text-center text-4xl font-bold tracking-tight sm:text-5xl"
      >
        {label}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="text-center text-sm text-muted-foreground"
      >
        {data.totalStats.totalSessions} sessions · {data.yearOptions.length} years
      </motion.p>

      {data.yearOptions.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="flex gap-2"
        >
          <button
            onClick={() => onYearChange(undefined)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              !year
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All Time
          </button>
          {data.yearOptions.map((y) => (
            <button
              key={y}
              onClick={() => onYearChange(y)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                year === y
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {y}
            </button>
          ))}
        </motion.div>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1, duration: 0.6 }}
        className="animate-pulse text-xs text-muted-foreground"
      >
        Scroll to explore ↓
      </motion.p>
    </div>
  );
}

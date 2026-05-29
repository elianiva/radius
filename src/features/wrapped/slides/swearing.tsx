import { motion } from "motion/react";

interface Props {
  totalSwears: number;
  topSwear: { word: string; count: number };
}

export function SwearingSlide({ totalSwears, topSwear }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-sm text-muted-foreground"
      >
        Frustration Meter
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="flex flex-col items-center gap-2"
      >
        <span className="text-7xl font-bold tabular-nums tracking-tight">
          {totalSwears}
        </span>
        <span className="text-sm text-muted-foreground">
          swear words uttered
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="rounded-full bg-muted px-6 py-2 text-sm"
      >
        Most used: <span className="font-bold">"{topSwear.word}"</span> · {topSwear.count}x
      </motion.div>
    </div>
  );
}

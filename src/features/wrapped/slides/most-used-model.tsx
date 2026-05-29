import { motion } from "motion/react";

interface Props {
  model: { name: string; count: number };
  totalSessions: number;
}

export function MostUsedModelSlide({ model, totalSessions }: Props) {
  const pct = ((model.count / totalSessions) * 100).toFixed(0);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-sm text-muted-foreground"
      >
        Your Go-To Brain
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="rounded-full bg-primary/10 px-8 py-3"
      >
        <span className="text-2xl font-bold text-primary">{model.name}</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="flex gap-6"
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl font-bold tabular-nums">{model.count}</span>
          <span className="text-xs text-muted-foreground">sessions</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl font-bold tabular-nums">{pct}%</span>
          <span className="text-xs text-muted-foreground">of total</span>
        </div>
      </motion.div>
    </div>
  );
}

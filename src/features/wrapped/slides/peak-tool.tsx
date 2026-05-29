import { motion } from "motion/react";

interface Props {
  tool: { name: string; calls: number };
}

export function PeakToolSlide({ tool }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-sm text-muted-foreground"
      >
        Your Most Used Tool
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="rounded-full bg-primary/10 px-8 py-3"
      >
        <span className="text-2xl font-bold text-primary">{tool.name}</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="flex flex-col items-center gap-1"
      >
        <span className="text-4xl font-bold tabular-nums">{tool.calls.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">total calls</span>
      </motion.div>
    </div>
  );
}

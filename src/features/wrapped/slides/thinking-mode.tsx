import { motion } from "motion/react";

interface Props {
	levels: { level: string; count: number }[];
}

const LEVEL_LABELS: Record<string, string> = {
	off: "Default",
	low: "Low",
	medium: "Medium",
	high: "High",
	normal: "Normal",
	"": "Default",
};

export function ThinkingModeSlide({ levels }: Props) {
	const total = levels.reduce((s, l) => s + l.count, 0);

	return (
		<div className="flex h-full flex-col items-center justify-center gap-8 px-6">
			<motion.h2
				initial={{ opacity: 0, y: 30 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ duration: 0.5 }}
				className="text-3xl font-bold tracking-tight"
			>
				Thinking Mode
			</motion.h2>

			<motion.p
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={{ once: true }}
				transition={{ delay: 0.15, duration: 0.4 }}
				className="text-sm text-muted-foreground"
			>
				How often you engaged deep thinking
			</motion.p>

			<div className="flex w-full max-w-sm flex-col gap-3">
				{levels.map((l, i) => {
					const pct = total > 0 ? (l.count / total) * 100 : 0;
					return (
						<motion.div
							key={l.level}
							initial={{ opacity: 0, x: -20 }}
							whileInView={{ opacity: 1, x: 0 }}
							viewport={{ once: true }}
							transition={{ delay: 0.1 * i + 0.3, duration: 0.4 }}
							className="flex items-center gap-3"
						>
							<span className="w-20 text-sm capitalize">{LEVEL_LABELS[l.level] ?? l.level}</span>
							<div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted">
								<motion.div
									initial={{ width: 0 }}
									whileInView={{ width: `${pct}%` }}
									viewport={{ once: true }}
									transition={{ delay: 0.1 * i + 0.5, duration: 0.6, ease: "easeOut" }}
									className="h-full rounded-sm"
									style={{
										backgroundColor: `var(--chart-${(i % 5) + 1})`,
										opacity: 0.7,
									}}
								/>
							</div>
							<span className="w-14 text-right text-sm font-bold tabular-nums">{l.count}</span>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}

import { motion } from "motion/react";

interface Props {
	busiestDay: { date: string; count: number };
}

export function BusiestDaySlide({ busiestDay }: Props) {
	const d = new Date(busiestDay.date + "T00:00:00Z");

	return (
		<div className="flex h-full flex-col items-center justify-center gap-8">
			<motion.p
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={{ once: true }}
				transition={{ duration: 0.5 }}
				className="text-sm text-muted-foreground"
			>
				Your Most Productive Day
			</motion.p>

			<motion.div
				initial={{ scale: 0 }}
				whileInView={{ scale: 1 }}
				viewport={{ once: true }}
				transition={{ type: "spring", stiffness: 150, damping: 12, delay: 0.2 }}
				className="flex flex-col items-center gap-2"
			>
				<span className="text-7xl font-bold tabular-nums tracking-tight">{busiestDay.count}</span>
				<span className="text-sm text-muted-foreground">sessions in a single day</span>
			</motion.div>

			<motion.div
				initial={{ opacity: 0, y: 20 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ delay: 0.5, duration: 0.5 }}
				className="rounded-full bg-muted px-6 py-2 text-sm font-medium"
			>
				{d.toLocaleDateString(undefined, {
					weekday: "long",
					year: "numeric",
					month: "long",
					day: "numeric",
				})}
			</motion.div>
		</div>
	);
}

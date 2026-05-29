import { motion } from "motion/react";
import type { WrappedData } from "../services/wrapped";
import { Sparkles } from "lucide-react";

interface Props {
	data: WrappedData;
}

export function ClosingSlide({ data }: Props) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-8 px-6">
			<motion.div
				initial={{ scale: 0, rotate: 10 }}
				whileInView={{ scale: 1, rotate: 0 }}
				viewport={{ once: true }}
				transition={{ type: "spring", stiffness: 200, damping: 15 }}
			>
				<Sparkles className="size-12 text-primary" />
			</motion.div>

			<motion.h2
				initial={{ opacity: 0, y: 30 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ delay: 0.2, duration: 0.6 }}
				className="text-center text-3xl font-bold tracking-tight"
			>
				That's a wrap!
			</motion.h2>

			<motion.div
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={{ once: true }}
				transition={{ delay: 0.4, duration: 0.6 }}
				className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground"
			>
				<span>{data.totalStats.totalSessions} sessions</span>
				<span className="text-muted-foreground/30">·</span>
				<span>{data.projectBreakdown.length} projects</span>
				<span className="text-muted-foreground/30">·</span>
				<span>{data.totalStats.totalToolCalls.toLocaleString()} tool calls</span>
				<span className="text-muted-foreground/30">·</span>
				<span>{data.totalStats.totalSwears} 😤</span>
			</motion.div>

			<motion.p
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={{ once: true }}
				transition={{ delay: 0.7, duration: 0.6 }}
				className="text-center text-xs text-muted-foreground"
			>
				Keep building. More sessions await.
			</motion.p>
		</div>
	);
}

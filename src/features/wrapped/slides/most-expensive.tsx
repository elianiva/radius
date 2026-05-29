import { motion } from "motion/react";
import type { ExtendedSession } from "../services/wrapped";
import { formatCost } from "~/lib/utils";

interface Props {
	session: ExtendedSession;
}

export function MostExpensiveSlide({ session }: Props) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-8">
			<motion.p
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={{ once: true }}
				transition={{ duration: 0.5 }}
				className="text-sm text-muted-foreground"
			>
				Most Expensive Session
			</motion.p>

			<motion.div
				initial={{ scale: 0 }}
				whileInView={{ scale: 1 }}
				viewport={{ once: true }}
				transition={{ type: "spring", stiffness: 150, damping: 12, delay: 0.2 }}
				className="flex flex-col items-center gap-2"
			>
				<span className="text-6xl font-bold tabular-nums tracking-tight">
					{formatCost(session.totalCost)}
				</span>
				<span className="text-sm text-muted-foreground">total cost</span>
			</motion.div>

			<motion.div
				initial={{ opacity: 0, y: 20 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ delay: 0.5, duration: 0.5 }}
				className="flex flex-col items-center gap-1 text-center"
			>
				<span className="text-sm font-medium">{session.title ?? "(untitled)"}</span>
				<span className="text-xs text-muted-foreground">{session.projectName}</span>
			</motion.div>
		</div>
	);
}

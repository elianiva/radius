import { motion } from "motion/react";
import type { WrappedData } from "../services/wrapped";
import { formatCost, formatTokens, formatDuration } from "~/lib/utils";

interface Props {
	data: WrappedData["totalStats"];
}

const items = [
	{ key: "Sessions", accessor: (d: Props["data"]) => String(d.totalSessions) },
	{ key: "Total Cost", accessor: (d: Props["data"]) => formatCost(d.totalCost) },
	{ key: "Total Tokens", accessor: (d: Props["data"]) => formatTokens(d.totalTokens) },
	{ key: "Tool Calls", accessor: (d: Props["data"]) => d.totalToolCalls.toLocaleString() },
	{ key: "Tool Errors", accessor: (d: Props["data"]) => d.totalToolErrors.toLocaleString() },
	{ key: "Total Time", accessor: (d: Props["data"]) => formatDuration(d.totalDuration) },
];

export function StatsSlide({ data }: Props) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-12">
			<motion.h2
				initial={{ opacity: 0, y: 30 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ duration: 0.5 }}
				className="text-3xl font-bold tracking-tight"
			>
				The Big Picture
			</motion.h2>

			<div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
				{items.map((item, i) => (
					<motion.div
						key={item.key}
						initial={{ opacity: 0, y: 40 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ delay: 0.15 * i + 0.2, duration: 0.5 }}
						className="flex flex-col items-center gap-1"
					>
						<span className="text-3xl font-bold tabular-nums tracking-tight">
							{item.accessor(data)}
						</span>
						<span className="text-xs text-muted-foreground">{item.key}</span>
					</motion.div>
				))}
			</div>
		</div>
	);
}

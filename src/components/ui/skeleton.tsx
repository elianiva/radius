import { cn } from "~/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="skeleton"
			className={cn(
				"relative isolate overflow-hidden rounded-none bg-muted/70 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/[0.06] before:to-transparent",
				className,
			)}
			{...props}
		/>
	);
}

export { Skeleton };

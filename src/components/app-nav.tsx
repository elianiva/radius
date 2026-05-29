import { Link, type LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

interface NavItem {
	to: LinkProps["to"];
	label: string;
	icon: LucideIcon;
}

interface AppNavProps {
	items: readonly NavItem[];
}

export function AppNav({ items }: AppNavProps) {
	return (
		<nav className="flex gap-1 border-b border-border">
			{items.map(({ to, label, icon: Icon }) => (
				<Link
					key={to}
					to={to}
					activeOptions={{ exact: true }}
					className="relative inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
					activeProps={{
						className:
							"text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary after:opacity-100",
					}}
				>
					<Icon className="size-3.5" />
					{label}
				</Link>
			))}
		</nav>
	);
}

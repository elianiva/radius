import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Folder } from "lucide-react";
import type { DashboardFilters } from "~/features/dashboard/services/filters";

interface ProjectFilterProps {
	filters: DashboardFilters;
	onFiltersChange: (filters: DashboardFilters) => void;
	projects: readonly { id: string; name: string }[];
}

export function ProjectFilter({ filters, onFiltersChange, projects }: ProjectFilterProps) {
	const [open, setOpen] = useState(false);

	if (projects.length === 0) return null;

	const handleToggle = (projectId: string) => {
		const current = filters.projectIds ?? [];
		const next = current.includes(projectId)
			? current.filter((id) => id !== projectId)
			: [...current, projectId];
		onFiltersChange({ ...filters, projectIds: next.length > 0 ? next : undefined });
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={(props) => (
					<Button {...props} variant="outline" size="xs" className="gap-1.5">
						<Folder className="size-3" />
						{filters.projectIds?.length ? `Projects (${filters.projectIds.length})` : "Projects"}
					</Button>
				)}
			/>
			<PopoverContent className="w-56 p-2" align="start">
				<div className="max-h-64 overflow-y-auto space-y-0.5">
					{projects.map((p) => (
						<label
							key={p.id}
							className="flex items-center gap-2 px-2 py-1.5 rounded-xs hover:bg-muted/50 cursor-pointer text-xs"
						>
							<input
								type="checkbox"
								checked={filters.projectIds?.includes(p.id) ?? false}
								onChange={() => handleToggle(p.id)}
								className="size-3 accent-foreground"
							/>
							<span className="truncate">{p.name}</span>
						</label>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

import { Button } from "~/components/ui/button";
import { X } from "lucide-react";
import type { DashboardFilters } from "~/features/dashboard/services/filters";
import { useFilterOptions } from "~/hooks/use-filter-options";
import { DateFilter } from "~/components/date-filter";
import { ProjectFilter } from "~/components/project-filter";
import { ModelFilter } from "~/components/model-filter";

interface FilterBarProps {
	filters: DashboardFilters;
	onFiltersChange: (filters: DashboardFilters) => void;
}

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
	const { projects, models } = useFilterOptions();

	const hasFilters =
		filters.dateFrom || filters.dateTo || filters.projectIds?.length || filters.model;

	return (
		<div className="flex items-center gap-2">
			<DateFilter filters={filters} onFiltersChange={onFiltersChange} />
			<ProjectFilter filters={filters} onFiltersChange={onFiltersChange} projects={projects} />
			<ModelFilter filters={filters} onFiltersChange={onFiltersChange} models={models} />
			{hasFilters && (
				<Button variant="ghost" size="icon-xs" onClick={() => onFiltersChange({})}>
					<X className="size-3" />
				</Button>
			)}
		</div>
	);
}

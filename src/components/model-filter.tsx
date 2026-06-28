import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Search } from "lucide-react";
import type { DashboardFilters } from "~/features/dashboard/services/filters";

interface ModelFilterProps {
	filters: DashboardFilters;
	onFiltersChange: (filters: DashboardFilters) => void;
	models: readonly string[];
}

export function ModelFilter({ filters, onFiltersChange, models }: ModelFilterProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	if (models.length === 0) return null;

	const handleSelect = (model: string) => {
		setOpen(false);
		setQuery("");
		onFiltersChange({ ...filters, model });
	};

	const filtered = (() => {
		if (!query.trim()) return models;
		const q = query.toLowerCase();
		return models.filter((m) => m.toLowerCase().includes(q));
	})();

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={(props) => (
					<Button {...props} variant="outline" size="xs" className="gap-1.5">
						<Search className="size-3" />
						{filters.model ?? "Model"}
					</Button>
				)}
			/>
			<PopoverContent className="w-56 p-2" align="start">
				<Input
					className="mb-2 h-7 text-xs"
					placeholder="Search model…"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					autoFocus
				/>
				<div className="max-h-48 overflow-y-auto space-y-0.5">
					{query.trim() && (
						<Button
							variant="ghost"
							size="xs"
							className="w-full justify-start text-xs"
							onClick={() => handleSelect(query)}
						>
							Search: "{query}"
						</Button>
					)}
					<Separator className="my-1" />
					{filtered.map((m) => (
						<Button
							key={m}
							variant={filters.model === m ? "secondary" : "ghost"}
							size="xs"
							className="w-full justify-start text-xs font-mono"
							onClick={() => handleSelect(m)}
						>
							{m}
						</Button>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

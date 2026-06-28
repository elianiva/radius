import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { CalendarDays, Folder, Search, X } from "lucide-react";
import {
	startOfDay,
	endOfDay,
	startOfWeek,
	startOfMonth,
	startOfYear,
	subDays,
	format,
} from "date-fns";
import type { DashboardFilters } from "~/features/dashboard/services/filters";

const PRESETS = [
	{ label: "Today", getRange: () => ({ from: startOfDay(new Date()), to: new Date() }) },
	{
		label: "Yesterday",
		getRange: () => ({
			from: startOfDay(subDays(new Date(), 1)),
			to: endOfDay(subDays(new Date(), 1)),
		}),
	},
	{
		label: "This week",
		getRange: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: new Date() }),
	},
	{
		label: "Last 7 days",
		getRange: () => ({ from: startOfDay(subDays(new Date(), 6)), to: new Date() }),
	},
	{ label: "This month", getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
	{
		label: "Last 30 days",
		getRange: () => ({ from: startOfDay(subDays(new Date(), 29)), to: new Date() }),
	},
	{ label: "This year", getRange: () => ({ from: startOfYear(new Date()), to: new Date() }) },
	{ label: "All time", getRange: () => ({ from: undefined, to: undefined }) },
] as const;

type PresetLabel = (typeof PRESETS)[number]["label"];

interface FilterBarProps {
	filters: DashboardFilters;
	onFiltersChange: (filters: DashboardFilters) => void;
	projects: readonly { id: string; name: string }[];
	models: readonly string[];
}

function formatRange(from?: number, to?: number): string {
	if (!from) return "All time";
	const fromDate = new Date(from);
	const toDate = to ? new Date(to) : new Date();
	const now = new Date();

	if (fromDate.getTime() === startOfDay(now).getTime()) return "Today";
	if (fromDate.getTime() === startOfDay(subDays(now, 1)).getTime()) return "Yesterday";
	if (fromDate.getTime() === startOfWeek(now, { weekStartsOn: 1 }).getTime())
		return format(fromDate, "MMM d") + " – Today";
	if (
		fromDate.getTime() === startOfDay(subDays(now, 6)).getTime() &&
		toDate.toDateString() === now.toDateString()
	)
		return "Last 7 days";
	if (fromDate.getTime() === startOfMonth(now).getTime()) return "This month";
	if (fromDate.getTime() === startOfDay(subDays(now, 29)).getTime()) return "Last 30 days";
	if (fromDate.getTime() === startOfYear(now).getTime()) return "This year";

	return format(from, "MMM d") + (to ? " – " + format(to, "MMM d, yyyy") : "");
}

export function FilterBar({ filters, onFiltersChange, projects, models }: FilterBarProps) {
	const [dateOpen, setDateOpen] = useState(false);
	const [projectOpen, setProjectOpen] = useState(false);
	const [modelOpen, setModelOpen] = useState(false);
	const [modelQuery, setModelQuery] = useState("");

	const selectedDateRange = (() => {
		if (!filters.dateFrom && !filters.dateTo) return undefined;
		return {
			from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
			to: filters.dateTo ? new Date(filters.dateTo) : undefined,
		};
	})();

	const hasFilters =
		filters.dateFrom || filters.dateTo || filters.projectIds?.length || filters.model;

	const displayRange = formatRange(filters.dateFrom, filters.dateTo);

	const handlePreset = (preset: PresetLabel) => {
		const presetFn = PRESETS.find((p) => p.label === preset);
		if (!presetFn) return;
		const range = presetFn.getRange();
		onFiltersChange({
			...filters,
			dateFrom: range.from?.getTime(),
			dateTo: range.to?.getTime(),
		});
		setDateOpen(false);
	};

	const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
		if (!range) return;
		if (range.from && range.to) {
			onFiltersChange({
				...filters,
				dateFrom: startOfDay(range.from).getTime(),
				dateTo: endOfDay(range.to).getTime(),
			});
			setDateOpen(false);
		}
	};

	const handleProjectToggle = (projectId: string) => {
		const current = filters.projectIds ?? [];
		const next = current.includes(projectId)
			? current.filter((id) => id !== projectId)
			: [...current, projectId];
		onFiltersChange({ ...filters, projectIds: next.length > 0 ? next : undefined });
	};

	const handleModelSelect = (model: string) => {
		setModelOpen(false);
		setModelQuery("");
		onFiltersChange({ ...filters, model });
	};

	const handleClear = () => {
		onFiltersChange({});
	};

	const filteredModels = (() => {
		if (!modelQuery.trim()) return models;
		const q = modelQuery.toLowerCase();
		return models.filter((m) => m.toLowerCase().includes(q));
	})();

	return (
		<div className="flex items-center gap-2">
			{/* Date filter */}
			<Popover open={dateOpen} onOpenChange={setDateOpen}>
				<PopoverTrigger
					render={(props) => (
						<Button {...props} variant="outline" size="xs" className="gap-1.5">
							<CalendarDays className="size-3" />
							{displayRange}
						</Button>
					)}
				/>
				<PopoverContent className="w-auto p-0" align="start">
					<div className="flex">
						<div className="border-r p-2 space-y-1">
							{PRESETS.map((preset) => (
								<Button
									key={preset.label}
									variant="ghost"
									size="xs"
									className="w-full justify-start"
									onClick={() => handlePreset(preset.label)}
								>
									{preset.label}
								</Button>
							))}
						</div>
						<div className="p-2">
							<Calendar
								mode="range"
								selected={selectedDateRange as { from: Date; to: Date } | undefined}
								onSelect={handleDateSelect}
								numberOfMonths={1}
								captionLayout="label"
							/>
						</div>
					</div>
				</PopoverContent>
			</Popover>

			{/* Project filter */}
			{projects.length > 0 && (
				<Popover open={projectOpen} onOpenChange={setProjectOpen}>
					<PopoverTrigger
						render={(props) => (
							<Button {...props} variant="outline" size="xs" className="gap-1.5">
								<Folder className="size-3" />
								{filters.projectIds?.length
									? `Projects (${filters.projectIds.length})`
									: "Projects"}
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
										onChange={() => handleProjectToggle(p.id)}
										className="size-3 accent-foreground"
									/>
									<span className="truncate">{p.name}</span>
								</label>
							))}
						</div>
					</PopoverContent>
				</Popover>
			)}

			{/* Model filter */}
			{models.length > 0 && (
				<Popover open={modelOpen} onOpenChange={setModelOpen}>
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
							value={modelQuery}
							onChange={(e) => setModelQuery(e.target.value)}
							autoFocus
						/>
						<div className="max-h-48 overflow-y-auto space-y-0.5">
							{modelQuery.trim() && (
								<Button
									variant="ghost"
									size="xs"
									className="w-full justify-start text-xs"
									onClick={() => handleModelSelect(modelQuery)}
								>
									Search: "{modelQuery}"
								</Button>
							)}
							<Separator className="my-1" />
							{filteredModels.map((m) => (
								<Button
									key={m}
									variant={filters.model === m ? "secondary" : "ghost"}
									size="xs"
									className="w-full justify-start text-xs font-mono"
									onClick={() => handleModelSelect(m)}
								>
									{m}
								</Button>
							))}
						</div>
					</PopoverContent>
				</Popover>
			)}

			{hasFilters && (
				<Button variant="ghost" size="icon-xs" onClick={handleClear}>
					<X className="size-3" />
				</Button>
			)}
		</div>
	);
}

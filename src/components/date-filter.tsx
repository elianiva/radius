import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { Button } from "~/components/ui/button";
import { CalendarDays } from "lucide-react";
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

interface DateFilterProps {
	filters: DashboardFilters;
	onFiltersChange: (filters: DashboardFilters) => void;
}

export function DateFilter({ filters, onFiltersChange }: DateFilterProps) {
	const [open, setOpen] = useState(false);

	const selectedDateRange = (() => {
		if (!filters.dateFrom && !filters.dateTo) return undefined;
		return {
			from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
			to: filters.dateTo ? new Date(filters.dateTo) : undefined,
		};
	})();

	const handlePreset = (preset: PresetLabel) => {
		const presetFn = PRESETS.find((p) => p.label === preset);
		if (!presetFn) return;
		const range = presetFn.getRange();
		onFiltersChange({
			...filters,
			dateFrom: range.from?.getTime(),
			dateTo: range.to?.getTime(),
		});
		setOpen(false);
	};

	const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
		if (!range) return;
		if (range.from && range.to) {
			onFiltersChange({
				...filters,
				dateFrom: startOfDay(range.from).getTime(),
				dateTo: endOfDay(range.to).getTime(),
			});
			setOpen(false);
		}
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={(props) => (
					<Button {...props} variant="outline" size="xs" className="gap-1.5">
						<CalendarDays className="size-3" />
						{formatRange(filters.dateFrom, filters.dateTo)}
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
	);
}

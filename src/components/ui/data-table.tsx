import { type ReactNode, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { cn } from "~/lib/utils";

export interface Column<T> {
	id: string;
	header: string;
	accessor: (row: T) => ReactNode;
	sortKey?: (row: T) => string | number;
	filterKey?: (row: T) => string;
	className?: string;
	headerClassName?: string;
}

interface DataTableProps<T> {
	columns: Column<T>[];
	data: T[];
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	sortKey?: string;
	sortDir?: "asc" | "desc";
	onSort?: (key: string) => void;
	getRowLink?: (row: T) => string;
	onRowClick?: (row: T) => void;
	searchQuery?: string;
	onSearchChange?: (query: string) => void;
	searchPlaceholder?: string;
	filterValue?: string;
	onFilterChange?: (value: string) => void;
	filterOptions?: { label: string; value: string }[];
	filterPlaceholder?: string;
	loading?: boolean;
}

function ShimmerRow({ cols }: { cols: number }) {
	return (
		<tr className="border-b last:border-0">
			{Array.from({ length: cols }, (_, j) => (
				<td key={j} className="px-3 py-2">
					<div
						className={cn(
							"relative isolate h-3 rounded-none bg-muted/70 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_ease-in-out_infinite] before:bg-linear-to-r before:from-transparent before:via-foreground/6 before:to-transparent",
							j === 0 ? "w-32" : j === 1 ? "w-16" : "w-14",
						)}
					/>
				</td>
			))}
		</tr>
	);
}

export function DataTable<T>({
	columns,
	data,
	page,
	totalPages,
	onPageChange,
	sortKey,
	sortDir,
	onSort,
	getRowLink,
	onRowClick,
	searchQuery,
	onSearchChange,
	searchPlaceholder = "Search…",
	filterValue,
	onFilterChange,
	filterOptions,
	filterPlaceholder = "All",
	loading,
}: DataTableProps<T>) {
	const hasToolbar = onSearchChange || onFilterChange;
	const searchRef = useRef<HTMLInputElement>(null);

	return (
		<div>
			{hasToolbar && (
				<div className="mb-3 flex items-center gap-2">
					{onSearchChange && (
						<div className="relative flex-1">
							<Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
							<input
								ref={searchRef}
								type="text"
								value={searchQuery ?? ""}
								onChange={(e) => onSearchChange(e.target.value)}
								placeholder={searchPlaceholder}
								className="h-7 w-full rounded-none border bg-transparent pl-7 pr-6 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
							/>
							{searchQuery && (
								<button
									onClick={() => {
										onSearchChange("");
										searchRef.current?.focus();
									}}
									className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								>
									<X className="size-3" />
								</button>
							)}
						</div>
					)}
					{onFilterChange && filterOptions && (
						<select
							value={filterValue ?? ""}
							onChange={(e) => onFilterChange(e.target.value)}
							className="h-7 rounded-none border bg-transparent px-2 text-xs text-foreground focus:border-foreground focus:outline-none"
						>
							<option value="">{filterPlaceholder}</option>
							{filterOptions.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					)}
				</div>
			)}

			<div className="overflow-x-auto rounded border">
				<table className="w-full text-xs">
					<thead>
						<tr className="border-b bg-muted/50">
							{columns.map((col) => (
								<th
									key={col.id}
									className={cn(
										"px-3 py-2 text-left text-xs font-medium text-muted-foreground",
										col.headerClassName,
										onSort && col.sortKey && "cursor-pointer hover:text-foreground",
									)}
									onClick={() => {
										if (onSort && col.sortKey) onSort(col.id);
									}}
								>
									{col.header}
									{sortKey === col.id && (
										<span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
									)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{loading ? (
							Array.from({ length: 6 }, (_, i) => <ShimmerRow key={i} cols={columns.length} />)
						) : data.length === 0 ? (
							<tr>
								<td
									colSpan={columns.length}
									className="px-3 py-12 text-center text-muted-foreground"
								>
									{searchQuery || filterValue ? "No matching sessions" : "No data"}
								</td>
							</tr>
						) : (
							data.map((row, i) => {
								const content = (
									<tr
										key={i}
										className={cn(
											"border-b last:border-0",
											(getRowLink || onRowClick) && "cursor-pointer hover:bg-muted/30",
										)}
										onClick={() => onRowClick?.(row)}
									>
										{columns.map((col) => (
											<td key={col.id} className={cn("px-3 py-2", col.className)}>
												{col.accessor(row)}
											</td>
										))}
									</tr>
								);

								if (getRowLink) {
									return (
										<Link key={i} to={getRowLink(row)} className="contents">
											{content}
										</Link>
									);
								}

								return content;
							})
						)}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="mt-3 flex items-center justify-center gap-2">
					<button
						onClick={() => onPageChange(page - 1)}
						disabled={page <= 1}
						className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
					>
						<ChevronLeft className="size-3" />
						Prev
					</button>
					<span className="text-xs tabular-nums text-muted-foreground">
						{page} / {totalPages}
					</span>
					<button
						onClick={() => onPageChange(page + 1)}
						disabled={page >= totalPages}
						className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
					>
						Next
						<ChevronRight className="size-3" />
					</button>
				</div>
			)}
		</div>
	);
}

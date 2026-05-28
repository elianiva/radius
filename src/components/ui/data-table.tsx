import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T> {
  id: string;
  header: string;
  accessor: (row: T) => ReactNode;
  sortKey?: (row: T) => string | number;
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
  loading?: boolean;
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
  loading,
}: DataTableProps<T>) {
  return (
    <div>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`px-3 py-2 text-left text-xs font-medium text-muted-foreground ${
                    col.headerClassName ?? ""
                  } ${onSort && col.sortKey ? "cursor-pointer hover:text-foreground" : ""}`}
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
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center text-muted-foreground">
                  No data
                </td>
              </tr>
            ) : (
              data.map((row, i) => {
                const content = (
                  <tr
                    key={i}
                    className={`border-b last:border-0 ${getRowLink ? "cursor-pointer hover:bg-muted/30" : ""}`}
                  >
                    {columns.map((col) => (
                      <td key={col.id} className={`px-3 py-2 ${col.className ?? ""}`}>
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

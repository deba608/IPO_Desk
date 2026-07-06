"use client";

import { useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Download,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Copy,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle,
  FileText,
  Loader2,
  Tag,
  Pencil,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AllotmentResult, CheckResponse } from "@/types/allotment.types";
import { usePanLabels } from "@/hooks/usePanLabels";
import { shareResultCard } from "../lib/shareCard";
import { toast } from "sonner";

interface ResultsDashboardProps {
  results: CheckResponse;
}

const STATUS_BADGE = {
  allotted: <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Allotted</Badge>,
  not_allotted: <Badge variant="danger" className="gap-1"><XCircle className="h-3 w-3" /> Not Allotted</Badge>,
  not_found: <Badge variant="warning" className="gap-1"><HelpCircle className="h-3 w-3" /> Not Found</Badge>,
  error: <Badge variant="danger" className="gap-1"><AlertCircle className="h-3 w-3" /> Error</Badge>,
};

export function ResultsDashboard({ results }: ResultsDashboardProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isExporting, setIsExporting] = useState<"csv" | "xlsx" | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const { labels, setLabel } = usePanLabels();

  const filteredData = useMemo(() => {
    if (statusFilter === "all") return results.results;
    return results.results.filter((r) => r.status === statusFilter);
  }, [results.results, statusFilter]);

  const columns: ColumnDef<AllotmentResult>[] = useMemo(
    () => [
      {
        accessorKey: "pan",
        header: "PAN",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <code className="font-mono text-sm font-medium text-primary">
              {row.original.pan}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(row.original.pan);
                toast.success("PAN copied!");
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        ),
      },
      {
        id: "label",
        header: "Label",
        accessorFn: (row) => labels[row.pan] ?? "",
        cell: ({ row }) => (
          <EditableLabel
            value={labels[row.original.pan] ?? ""}
            onSave={(v) => setLabel(row.original.pan, v)}
          />
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.name ?? <span className="text-muted-foreground">—</span>}
          </span>
        ),
      },
      {
        accessorKey: "appliedShares",
        header: "Applied",
        cell: ({ row }) => (
          <span className="font-mono text-sm tabular-nums">
            {row.original.appliedShares?.toLocaleString() ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "allottedShares",
        header: "Allotted",
        cell: ({ row }) => (
          <span
            className={`font-mono text-sm tabular-nums font-semibold ${
              (row.original.allottedShares ?? 0) > 0
                ? "text-emerald-400"
                : "text-muted-foreground"
            }`}
          >
            {row.original.allottedShares?.toLocaleString() ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) =>
          STATUS_BADGE[row.original.status] ?? row.original.status,
        filterFn: (row, _id, filterValue) => {
          if (filterValue === "all") return true;
          return row.original.status === filterValue;
        },
      },
    ],
    [labels, setLabel]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const handleExport = async (format: "csv" | "xlsx") => {
    setIsExporting(format);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: results.results.map((r) => ({
            ...r,
            label: labels[r.pan],
          })),
          format,
          ipoName: results.ipoName,
          checkedAt: results.checkedAt,
        }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const date = new Date(results.checkedAt).toISOString().split("T")[0];
      a.download = `allotment-${date}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(null);
    }
  };

  const { total, allotted, notAllotted, notFound } = results.summary;

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const rate = total > 0 ? Math.round((allotted / total) * 100) : 0;
      const outcome = await shareResultCard(
        {
          title: "Allotment Result",
          subtitle: results.ipoName,
          headline: allotted > 0 ? `${allotted} of ${total} allotted` : "No allotment",
          positive: allotted > 0,
          stats: [
            { label: "Allotted", value: String(allotted) },
            { label: "Not Allotted", value: String(notAllotted) },
            { label: "Checked", value: String(total) },
            { label: "Win Rate", value: `${rate}%` },
          ],
        },
        `ipo-allotment-${results.ipoName.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40)}.png`
      );
      toast.success(outcome === "shared" ? "Shared!" : "Image downloaded");
    } catch {
      toast.error("Couldn't generate share image");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold">Results</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
            {results.ipoName} · Checked{" "}
            {new Date(results.checkedAt).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            disabled={isSharing}
            className="gap-2 flex-1 sm:flex-none"
          >
            {isSharing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={isExporting !== null}
            className="gap-2 flex-1 sm:flex-none"
          >
            {isExporting === "csv" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("xlsx")}
            disabled={isExporting !== null}
            className="gap-2 flex-1 sm:flex-none"
          >
            {isExporting === "xlsx" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        <SummaryCard
          label="Total Checked"
          value={total}
          icon={<ChevronsUpDown className="h-4 w-4" />}
          color="text-foreground"
        />
        <SummaryCard
          label="Allotted"
          value={allotted}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="text-emerald-400"
          bgClass="bg-emerald-500/10 border-emerald-500/20"
        />
        <SummaryCard
          label="Not Allotted"
          value={notAllotted}
          icon={<XCircle className="h-4 w-4" />}
          color="text-rose-400"
          bgClass="bg-rose-500/10 border-rose-500/20"
        />
        <SummaryCard
          label="Not Found"
          value={notFound}
          icon={<HelpCircle className="h-4 w-4" />}
          color="text-amber-400"
          bgClass="bg-amber-500/10 border-amber-500/20"
        />
        <div className="rounded-xl border border-border bg-card p-4 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Success Rate</span>
          </div>
          <div className="text-2xl font-bold text-primary">
            {total > 0 ? Math.round((allotted / total) * 100) : 0}%
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${total > 0 ? (allotted / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 space-y-0 pb-4 px-4 sm:px-6">
          <CardTitle className="text-sm sm:text-base">Detailed Results</CardTitle>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* Status Filter */}
            <div className="flex gap-1 overflow-x-auto pb-0.5 w-full sm:w-auto">
              {["all", "allotted", "not_allotted", "not_found"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`shrink-0 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {s === "all"
                    ? "All"
                    : s === "allotted"
                    ? "Allotted"
                    : s === "not_allotted"
                    ? "Not Allotted"
                    : "Not Found"}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={globalFilter ?? ""}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="h-8 pl-8 text-sm w-full sm:w-44"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr
                    key={headerGroup.id}
                    className="border-y border-border bg-muted/30"
                  >
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left font-medium text-muted-foreground first:pl-6 last:pr-6"
                      >
                        {header.isPlaceholder ? null : (
                          <button
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {header.column.getIsSorted() === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                            )}
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`group border-b border-border/50 transition-colors hover:bg-muted/30 ${
                      i % 2 === 0 ? "" : "bg-muted/10"
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3.5 first:pl-6 last:pr-6"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {table.getRowModel().rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="font-medium">No results found</p>
              <p className="text-sm text-muted-foreground">
                Try a different search or status filter
              </p>
            </div>
          )}

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 sm:px-6 py-3">
            <p className="text-xs text-muted-foreground order-2 sm:order-1">
              Showing {table.getRowModel().rows.length} of{" "}
              {filteredData.length} results
            </p>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 sm:px-3"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Prev
                </Button>
                <span className="px-1 sm:px-2 text-xs tabular-nums">
                  {table.getState().pagination.pageIndex + 1}/{table.getPageCount()}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 sm:px-3"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Inline-editable nickname for a PAN. Renders a subtle "+ Label" affordance when
 * empty, a tag chip when set; click to edit. Enter / blur saves, Escape cancels.
 */
function EditableLabel({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const start = () => {
    setDraft(value);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") setEditing(false);
        }}
        maxLength={24}
        placeholder="e.g. Self, Spouse, HUF"
        className="h-7 w-32 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    );
  }

  if (value) {
    return (
      <button
        type="button"
        onClick={start}
        className="group/lbl inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
      >
        <Tag className="h-3 w-3" />
        {value}
        <Pencil className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover/lbl:opacity-70" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
    >
      <Tag className="h-3 w-3" />
      Label
    </button>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  bgClass?: string;
}

function SummaryCard({
  label,
  value,
  icon,
  color = "text-foreground",
  bgClass = "bg-card border-border",
}: SummaryCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${bgClass}`}>
      <div className={`flex items-center gap-2 text-xs mb-2 ${color} opacity-70`}>
        {icon}
        {label}
      </div>
      <div className={`text-3xl font-bold tabular-nums ${color}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

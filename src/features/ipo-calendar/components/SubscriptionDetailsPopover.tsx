"use client";

import { Flame, Clock } from "lucide-react";
import { Subscription } from "@/types/calendar.types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SubscriptionDetailsPopoverProps {
  subscription: Subscription;
  trigger: React.ReactNode;
}

export function SubscriptionDetailsPopover({ subscription, trigger }: SubscriptionDetailsPopoverProps) {
  const { qib, retail, nii, total, updatedAt } = subscription;

  const getProgressWidth = (val: number | undefined) => {
    if (val === undefined) return 0;
    // Map 0 -> 1x subscription to 0% -> 100%. Anything above 1x is 100%.
    return Math.min(100, val * 100);
  };

  const getBarColor = (val: number | undefined) => {
    if (val === undefined) return "bg-slate-700";
    if (val >= 1) return "bg-emerald-500";
    return "bg-indigo-500";
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="focus:outline-none outline-none inline-block text-left"
        >
          {trigger}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 max-w-[calc(100vw-2rem)] bg-slate-900 border-slate-800 text-slate-100 p-4 shadow-xl"
        align="center"
        side="top"
        collisionPadding={16}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-3">
          <Flame className="h-4 w-4 text-orange-400" />
          <h4 className="text-xs font-semibold text-slate-200">
            Subscription Breakdown
          </h4>
        </div>

        <div className="space-y-3">
          {/* Retail */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">Retail Demand</span>
              <span className={cn("font-semibold", retail !== undefined && retail >= 1 ? "text-emerald-400" : "text-indigo-400")}>
                {retail !== undefined ? `${retail.toFixed(2)}x` : "N/A"}
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", getBarColor(retail))}
                style={{ width: `${getProgressWidth(retail)}%` }}
              />
            </div>
          </div>

          {/* QIB */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">QIB (Institutional)</span>
              <span className={cn("font-semibold", qib !== undefined && qib >= 1 ? "text-emerald-400" : "text-indigo-400")}>
                {qib !== undefined ? `${qib.toFixed(2)}x` : "N/A"}
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", getBarColor(qib))}
                style={{ width: `${getProgressWidth(qib)}%` }}
              />
            </div>
          </div>

          {/* NII */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">NII (Non-Institutional)</span>
              <span className={cn("font-semibold", nii !== undefined && nii >= 1 ? "text-emerald-400" : "text-indigo-400")}>
                {nii !== undefined ? `${nii.toFixed(2)}x` : "N/A"}
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", getBarColor(nii))}
                style={{ width: `${getProgressWidth(nii)}%` }}
              />
            </div>
          </div>

          {/* Total */}
          <div className="h-px bg-slate-800 my-2" />
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-200">Total Bids</span>
            <span className={cn("text-sm", total !== undefined && total >= 1 ? "text-emerald-400" : "text-indigo-400")}>
              {total !== undefined ? `${total.toFixed(2)}x` : "N/A"}
            </span>
          </div>
        </div>

        {updatedAt && (
          <div className="flex items-center gap-1 mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-500">
            <Clock className="h-3 w-3" />
            <span>
              Updated{" "}
              {new Date(updatedAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              IST
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

import React from "react";
import { CheckCircle2, XCircle, Shield, CheckSquare, Square } from "lucide-react";
import Button from "../common/Button";

interface BulkHospitalToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  allSelected: boolean;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  isLoading?: boolean;
}

export const BulkHospitalToolbar: React.FC<BulkHospitalToolbarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  allSelected,
  onBulkApprove,
  onBulkReject,
  isLoading = false,
}) => {
  if (totalCount === 0) return null;

  return (
    <div className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          {allSelected ? (
            <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <Square className="w-4 h-4 text-slate-400" />
          )}
          <span>{allSelected ? "Deselect All" : "Select All"}</span>
        </button>

        {selectedCount > 0 && (
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
            {selectedCount} selected
          </span>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
            onClick={onBulkApprove}
            disabled={isLoading}
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Approve Selected ({selectedCount})
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/40"
            onClick={onBulkReject}
            disabled={isLoading}
          >
            <XCircle className="w-4 h-4 mr-1.5" />
            Reject Selected ({selectedCount})
          </Button>
        </div>
      )}
    </div>
  );
};

export default BulkHospitalToolbar;

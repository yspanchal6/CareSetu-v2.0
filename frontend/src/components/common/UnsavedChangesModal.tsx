import React from "react";
import { AlertTriangle, Save, ArrowRight, X } from "lucide-react";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onConfirmExit: () => void;
  onSaveDraftAndExit?: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  hasSaveDraftOption?: boolean;
}

export function UnsavedChangesModal({
  isOpen,
  onConfirmExit,
  onSaveDraftAndExit,
  onCancel,
  title = "Unsaved Changes Detected",
  description = "You have unsaved changes in your form. Any un-saved field edits will be lost if you leave without saving draft progress.",
  hasSaveDraftOption = true,
}: UnsavedChangesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-modal-title"
    >
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-5 text-left relative">
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 id="unsaved-modal-title" className="text-lg font-bold text-navy leading-snug">
              {title}
            </h3>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Unsaved Draft Progress
            </span>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          {description}
        </p>

        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <Save className="w-3.5 h-3.5 text-sky" />
            <span>What happens next?</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-500 pl-1">
            <li>You can complete or edit your details later from your Dashboard or Settings.</li>
            <li>Restricted role-specific features remain disabled until requirements are verified.</li>
          </ul>
        </div>

        <div className="flex flex-col gap-2.5 pt-1 sm:flex-row-reverse">
          {hasSaveDraftOption && onSaveDraftAndExit && (
            <button
              type="button"
              onClick={onSaveDraftAndExit}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky hover:bg-sky/90 text-white font-semibold text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-sky/40"
            >
              <Save className="w-4 h-4" />
              <span>Save Draft & Exit</span>
            </button>
          )}

          <button
            type="button"
            onClick={onConfirmExit}
            className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-sm transition-colors border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
          >
            <span>Discard & Leave</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors"
          >
            Keep Editing
          </button>
        </div>
      </div>
    </div>
  );
}

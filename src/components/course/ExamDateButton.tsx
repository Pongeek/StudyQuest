"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ExamDateButtonProps {
  courseId: string;
  /** Current exam date in YYYY-MM-DD or null if not set */
  examDate: string | null;
  examLabel: string | null;
}

/**
 * Small panel on the course detail page for setting / clearing the exam
 * date and an optional short label (e.g. "Midterm", "Final").
 *
 * When a date is set, the dashboard automatically shows a countdown widget
 * with today's auto-generated study plan.
 */
export default function ExamDateButton({
  courseId,
  examDate,
  examLabel,
}: ExamDateButtonProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [dateInput, setDateInput] = useState(examDate ?? "");
  const [labelInput, setLabelInput] = useState(examLabel ?? "");
  const [busy, setBusy] = useState(false);

  const hasDate = !!examDate;

  // Friendly display string for the saved exam date (e.g. "May 28, 2026")
  let dateDisplay = "";
  if (examDate) {
    const d = new Date(examDate + "T12:00:00");
    dateDisplay = d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // Compute days remaining for the chip color/copy
  let daysRemaining: number | null = null;
  if (examDate) {
    const d = new Date(examDate + "T00:00:00");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    daysRemaining = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  }

  const save = async () => {
    if (busy) return;
    if (!dateInput) {
      toast.error("Pick an exam date first");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/exam-date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examDate: dateInput,
          examLabel: labelInput || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to save");
      }
      toast.success("Exam date saved");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/exam-date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examDate: null, examLabel: null }),
      });
      if (!res.ok) throw new Error("Failed to clear");
      toast.success("Exam date cleared");
      setDateInput("");
      setLabelInput("");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clear");
    } finally {
      setBusy(false);
    }
  };

  // ── Display mode ─────────────────────────────────────────────────────────
  if (!editing) {
    if (!hasDate) {
      return (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium hover:bg-indigo-500/15 hover:border-indigo-500/40 transition-colors"
        >
          <CalendarDays className="w-4 h-4" />
          Set exam date
        </button>
      );
    }

    // Color the chip by urgency
    const urgencyClass =
      daysRemaining === null
        ? "border-white/[0.07] bg-white/[0.04] text-slate-300"
        : daysRemaining < 0
        ? "border-slate-700/40 bg-slate-800/40 text-slate-500"
        : daysRemaining === 0
        ? "border-red-500/40 bg-red-500/15 text-red-300 animate-pulse"
        : daysRemaining <= 3
        ? "border-red-500/30 bg-red-500/10 text-red-300"
        : daysRemaining <= 7
        ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
        : daysRemaining <= 14
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    return (
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-sm",
            urgencyClass
          )}
        >
          <CalendarDays className="w-4 h-4 shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold">
              {examLabel || "Exam"}: {dateDisplay}
            </span>
            {daysRemaining !== null && (
              <span className="text-[11px] font-medium opacity-80">
                {daysRemaining < 0
                  ? `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago`
                  : daysRemaining === 0
                  ? "Today!"
                  : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} away`}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1"
        >
          Edit
        </button>
      </div>
    );
  }

  // ── Edit mode ────────────────────────────────────────────────────────────
  return (
    <div className="rpg-card rounded-xl p-4 space-y-3 max-w-md">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wider font-medium text-slate-400">
          Exam details
        </span>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-slate-500 hover:text-slate-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-slate-400 font-medium" htmlFor="exam-date-input">
          Date
        </label>
        <input
          id="exam-date-input"
          type="date"
          value={dateInput}
          onChange={(e) => setDateInput(e.target.value)}
          className="w-full bg-slate-800/60 border border-slate-700/50 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-slate-400 font-medium" htmlFor="exam-label-input">
          Label <span className="text-slate-600">(optional)</span>
        </label>
        <input
          id="exam-label-input"
          type="text"
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          placeholder="e.g. Final, Midterm"
          maxLength={64}
          className="w-full bg-slate-800/60 border border-slate-700/50 text-white text-sm rounded-md px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={save}
          disabled={busy || !dateInput}
          className="bg-indigo-500 hover:bg-indigo-400 text-white gap-1.5"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5" />}
          Save
        </Button>
        {hasDate && (
          <Button
            size="sm"
            variant="outline"
            onClick={clear}
            disabled={busy}
            className="border-slate-700/50 text-slate-400 hover:text-red-300 hover:border-red-500/40 hover:bg-red-500/5"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

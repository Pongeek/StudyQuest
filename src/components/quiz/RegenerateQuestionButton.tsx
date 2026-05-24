"use client";

import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { readClassifiedErrorFromResponse, classifyAiError } from "@/lib/ai-error";

/**
 * Re-generate a single question via Claude. Two visual variants:
 *   - `inline`   small icon button used inside QuizEngine / ReviewEngine
 *   - `label`    icon + "REGENERATE" pixel label used in TopicMasteryPanel
 *                Stumbles section
 *
 * On success calls `onRegenerated` with the new question payload — engines
 * use this to swap the question in their local state; the Stumbles button
 * uses it to trigger router.refresh() and let the stumble disappear from
 * the server-rendered list.
 *
 * Failures route through `classifyAiError` so the toast matches the same
 * voice + retryability semantics as the grader failure UX (RATE_LIMITED,
 * OVERLOADED, BUDGET_CAP, etc.).
 */

export interface RegeneratedQuestion {
  id: string;
  topic_id: string;
  type: "mcq" | "open";
  content: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  difficulty: number;
  created_at: string;
}

interface RegenerateQuestionButtonProps {
  questionId: string;
  variant?: "inline" | "label";
  /** Optional className override for the outer button. */
  className?: string;
  /** Hide the button entirely while disabled (e.g. after grading). */
  disabled?: boolean;
  /** Called after the API responds with the new question. */
  onRegenerated?: (newQuestion: RegeneratedQuestion) => void;
}

export default function RegenerateQuestionButton({
  questionId,
  variant = "inline",
  className,
  disabled = false,
  onRegenerated,
}: RegenerateQuestionButtonProps) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleClick = async () => {
    if (busy || disabled) return;
    // Two-step confirm via local state so we don't pull in a Dialog dep
    // for what's essentially a single-line "are you sure" prompt.
    if (!confirming) {
      setConfirming(true);
      // Auto-dismiss the confirm state after 4s so the button doesn't sit
      // in "Confirm?" mode forever.
      setTimeout(() => setConfirming(false), 4000);
      return;
    }

    setBusy(true);
    setConfirming(false);
    try {
      const res = await fetch(`/api/questions/${questionId}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) {
        const classified = await readClassifiedErrorFromResponse(res);
        toast.error(classified.userMessage, { duration: 6000 });
        return;
      }
      const { question } = (await res.json()) as { question: RegeneratedQuestion };
      toast.success("New variant generated. Old question retired.", {
        duration: 2500,
      });
      onRegenerated?.(question);
    } catch (err) {
      console.error("[RegenerateQuestionButton] failed:", err);
      const classified = classifyAiError(err);
      toast.error(classified.userMessage, { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  if (variant === "label") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || disabled}
        aria-busy={busy}
        title={confirming ? "Tap again to confirm" : "Replace this question with a fresh AI variant"}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 font-pixel text-[9px] tracking-wider transition-colors pixel-border",
          confirming
            ? "bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse"
            : "bg-slate-900/60 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10",
          (busy || disabled) && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {busy ? (
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="w-3 h-3" aria-hidden />
        )}
        {busy ? "RE-CASTING…" : confirming ? "CONFIRM?" : "REGENERATE"}
      </button>
    );
  }

  // Inline variant — small icon-only button for in-quiz placement.
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || disabled}
      aria-busy={busy}
      aria-label={
        confirming
          ? "Tap again to regenerate this question"
          : "Regenerate this question — replaces it with a fresh AI variant"
      }
      title={
        confirming
          ? "Tap again to confirm"
          : "Regenerate — replaces this question with a fresh AI variant"
      }
      className={cn(
        "group inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md border transition-colors",
        confirming
          ? "border-amber-500/50 bg-amber-500/15 text-amber-300 animate-pulse"
          : "border-slate-700 bg-slate-900/40 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 hover:bg-amber-500/10",
        (busy || disabled) && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {busy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="w-3.5 h-3.5" aria-hidden />
      )}
      <span>
        {busy ? "Regenerating…" : confirming ? "Tap again to confirm" : "Regenerate"}
      </span>
    </button>
  );
}

"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Dice5, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import MarkdownContent from "./MarkdownContent";
import { readClassifiedErrorFromResponse } from "@/lib/ai-error";

interface LuckyGuessExplanationProps {
  /** The persisted answer id — required to scope the /api/clarify call.
   *  quiz_answers.id when answerKind is "quiz", review_answers.id when
   *  "review". */
  answerId: string;
  /** Which answer table answerId points at. Defaults to "quiz" so the
   *  existing Quiz call site stays untouched; Review passes "review". */
  answerKind?: "quiz" | "review";
  /** Parent direction — passed through so RTL Hebrew renders correctly. */
  dir?: "ltr" | "rtl";
}

type Status = "collapsed" | "loading" | "open";

/**
 * Single-shot Loremaster explanation that surfaces inline beneath
 * ConfidenceRow when the student rates a RIGHT answer as "I guessed".
 *
 * Lifecycle:
 *  - Mounts collapsed. NO auto-probe (the /api/clarify OPEN branch fires
 *    Claude when no cached row exists; auto-probing every lucky-guess
 *    would burn tokens on explanations the user never reads).
 *  - On tap: POST /api/clarify. Server returns cached message OR fires
 *    one Claude call + persists. Component expands.
 *  - Revisit (navigate away/back): component remounts collapsed; re-tap
 *    returns the cached row instantly (no Claude call).
 *
 * Pairs visually with the SessionDebrief lucky-win chip (amber + Dice5 +
 * pixel chrome).
 */
export default function LuckyGuessExplanation({
  answerId,
  answerKind = "quiz",
  dir,
}: LuckyGuessExplanationProps) {
  const [status, setStatus] = useState<Status>("collapsed");
  const [content, setContent] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const open = async () => {
    if (status === "loading" || status === "open") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerKind, answerId }),
      });
      if (!res.ok) {
        const classified = await readClassifiedErrorFromResponse(res);
        toast.error(classified.userMessage);
        setStatus("collapsed");
        return;
      }
      const data = await res.json();
      const first = Array.isArray(data.messages) ? data.messages[0] : null;
      const text: string | undefined = first?.content;
      if (!text) {
        toast.error("The Loremaster's tome was empty — try again.");
        setStatus("collapsed");
        return;
      }
      setContent(text);
      setStatus("open");
    } catch {
      toast.error("Couldn't reach the Loremaster. Check your connection and retry.");
      setStatus("collapsed");
    }
  };

  if (status === "collapsed" || status === "loading") {
    return (
      <button
        type="button"
        onClick={open}
        disabled={status === "loading"}
        aria-busy={status === "loading"}
        className={cn(
          "mt-3 inline-flex items-center gap-1.5 pixel-chip px-3 py-1.5 font-pixel text-[9px] tracking-wider",
          "text-amber-300 border border-amber-500/30 hover:bg-amber-500/10",
          "disabled:opacity-70 disabled:cursor-not-allowed",
        )}
      >
        {status === "loading" ? (
          <>
            <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin" />
            CONSULTING THE TOME…
          </>
        ) : (
          <>
            <Dice5 aria-hidden className="w-3.5 h-3.5" />
            HEAR THE LOREMASTER&apos;S TAKE →
          </>
        )}
      </button>
    );
  }

  // status === "open"
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      role="region"
      aria-label="Loremaster's take"
      dir={dir}
      className="mt-3 pixel-border bg-amber-500/10 px-4 py-3 relative"
    >
      {/* Pixel-nail corners — peer vocabulary: 1.5 offset + z-[2]. */}
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[2]" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[2]" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[2]" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[2]" />

      <div className="flex items-center gap-2 mb-2">
        <Dice5 aria-hidden className="w-4 h-4 text-amber-400" />
        <span className="font-pixel text-[9px] tracking-wider text-amber-400">
          LOREMASTER&apos;S TAKE
        </span>
      </div>

      <div className="text-sm text-slate-200 leading-relaxed">
        <MarkdownContent>{content ?? ""}</MarkdownContent>
      </div>
    </motion.div>
  );
}

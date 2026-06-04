"use client";

import { useState } from "react";
import { Loader2, Printer, ScrollText, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import MarkdownContent from "@/components/quiz/MarkdownContent";
import { readClassifiedErrorFromResponse } from "@/lib/ai-error";
import { INLINE_COPY } from "@/lib/loading-copy";

interface CheatSheetPanelProps {
  topicId: string;
  /** Pre-fetched cached content from the parent server component (may be null). */
  initialContent: string | null;
  initialGeneratedAt: string | null;
  /** Text direction for the rendered content (matches the topic page). */
  dir?: "ltr" | "rtl" | "auto";
}

/**
 * Inline cheat-sheet panel on the topic detail page.
 *
 * - Initial render uses server-supplied cached content if present.
 * - "Generate" button (cold state) fires POST /api/topics/[id]/cheat-sheet.
 * - Once content exists, "Regenerate" overwrites; "Print" pops the native
 *   browser print dialog (Cmd/Ctrl+P also works — we hint it).
 * - All error handling routes through the classified-error envelope so the
 *   toast tells the student what actually broke (rate-limit / network / etc).
 *
 * Print styling is intentionally not added here yet; the existing page
 * chrome prints decently when the content is wide. If you want a true
 * one-page-printable view later, add @media print rules in globals.css.
 */
export default function CheatSheetPanel({
  topicId,
  initialContent,
  initialGeneratedAt,
  dir = "auto",
}: CheatSheetPanelProps) {
  const [content, setContent] = useState<string | null>(initialContent);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initialGeneratedAt);
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/topics/${topicId}/cheat-sheet`, {
        method: "POST",
      });
      if (!res.ok) {
        const cls = await readClassifiedErrorFromResponse(res);
        toast.error(cls?.userMessage ?? "Couldn't generate the cheat sheet — try again.");
        return;
      }
      const data = await res.json();
      setContent(data.content ?? null);
      setGeneratedAt(data.generatedAt ?? null);
      toast.success("Cheat sheet ready.");
    } catch {
      toast.error("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  // Cold state — no cheat sheet generated yet.
  if (!content) {
    return (
      <section className="rpg-card rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400" />
        <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400" />
        <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400" />
        <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400" />

        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
          <ScrollText className="w-6 h-6 text-amber-400" />
        </div>
        <h3 className="font-pixel text-[10px] tracking-wider text-amber-300 mb-1">
          CHEAT SHEET · NOT YET FORGED
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-4">
          A compact, formula-dense one-pager you can print and scan before an exam.
          Definitions, core results, worked example, common pitfalls.
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className={cn(
            "pixel-chip inline-flex items-center gap-2 px-4 py-2 font-pixel text-[10px] tracking-wider text-amber-300 border border-amber-500/40 transition-colors",
            busy ? "opacity-60 cursor-not-allowed" : "hover:bg-amber-500/10",
          )}
        >
          {busy ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {INLINE_COPY.cheatSheet.toUpperCase()}
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              FORGE CHEAT SHEET
            </>
          )}
        </button>
      </section>
    );
  }

  // Has content — render it + meta + action buttons.
  return (
    <section className="rpg-card rounded-2xl p-5 sm:p-6 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400" />

      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <ScrollText className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-pixel text-[10px] tracking-wider text-amber-300">
              CHEAT SHEET
            </h3>
            {generatedAt && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                Forged{" "}
                {new Date(generatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
                {" · Cmd/Ctrl+P to print"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="pixel-chip inline-flex items-center gap-1.5 px-2.5 py-1 font-pixel text-[8px] tracking-wider text-slate-300 border border-white/[0.08] hover:bg-white/[0.04]"
          >
            <Printer className="w-3 h-3" />
            PRINT
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className={cn(
              "pixel-chip inline-flex items-center gap-1.5 px-2.5 py-1 font-pixel text-[8px] tracking-wider text-amber-300 border border-amber-500/30 transition-colors",
              busy ? "opacity-60 cursor-not-allowed" : "hover:bg-amber-500/10",
            )}
          >
            {busy ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {busy ? INLINE_COPY.cheatSheet.toUpperCase() : "REFORGE"}
          </button>
        </div>
      </header>

      <div dir={dir} className="cheat-sheet-content prose prose-invert max-w-none">
        <MarkdownContent>{content}</MarkdownContent>
      </div>
    </section>
  );
}

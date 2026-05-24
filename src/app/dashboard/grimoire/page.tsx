"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, Swords, BookOpen, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GrimoireDemon } from "@/app/api/grimoire/route";
import MarkdownInline from "@/components/quiz/MarkdownInline";

interface GrimoireData {
  demons: GrimoireDemon[];
  totalCount: number;
  activeCount: number;
}

export default function GrimoirePage() {
  const router = useRouter();
  const [data, setData] = useState<GrimoireData | null>(null);
  const [loading, setLoading] = useState(true);
  const [slaying, setSlaying] = useState(false);

  const fetchDemons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/grimoire");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDemons(); }, [fetchDemons]);

  const handleSlay = async () => {
    if (slaying) return;
    setSlaying(true);
    try {
      const res = await fetch("/api/grimoire/session", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create session");
      const { sessionId } = await res.json();
      router.push(`/dashboard/grimoire/session/${sessionId}`);
    } catch {
      setSlaying(false);
    }
  };

  const allCleared = !!data && data.totalCount > 0 && data.activeCount === 0;
  const hasActiveDemons = !!data && data.activeCount > 0;

  return (
    <div className="space-y-8 pb-16">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            {/* Icon tile — pixel-border, state-colored. Nail corners match. */}
            <div
              className={cn(
                "relative w-12 h-12 pixel-border flex items-center justify-center text-xl transition-colors duration-300",
                allCleared
                  ? "bg-green-500/15 text-green-300"
                  : "bg-purple-500/15 text-purple-300"
              )}
              aria-hidden
            >
              {allCleared ? "⚔️" : "📕"}
            </div>
            <div>
              <p
                className={cn(
                  "font-pixel text-[9px] tracking-wider mb-1 transition-colors duration-300",
                  allCleared ? "text-green-400/90" : "text-purple-400/90"
                )}
              >
                MISTAKE GRIMOIRE
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                {allCleared ? "Demons Vanquished" : "Settle the Score"}
              </h1>
            </div>
          </div>
          <p className="text-slate-400 text-sm">
            {!data
              ? "Loading your demons…"
              : hasActiveDemons
              ? `${data.activeCount} unsettled demon${data.activeCount !== 1 ? "s" : ""} await your reckoning.`
              : allCleared
              ? "All demons have been slain. The grimoire is sealed."
              : "Your grimoire is empty — stay vigilant."}
          </p>
        </div>

        {/* Only show the slay button when there are active unsettled demons.
            Chunky purple pixel-shadow CTA matching the dashboard widget. */}
        {hasActiveDemons && (
          <button
            onClick={handleSlay}
            disabled={slaying}
            className={cn(
              "shrink-0 px-5 py-3 flex items-center justify-center gap-2 font-pixel text-[10px] tracking-wider",
              "bg-purple-500 text-white shadow-[0_4px_0_0_#581c87]",
              "hover:shadow-[0_2px_0_0_#581c87] hover:translate-y-0.5",
              "active:shadow-[0_0_0_0_#581c87] active:translate-y-1",
              "disabled:opacity-50 disabled:translate-y-0 disabled:shadow-[0_4px_0_0_#581c87]",
              "transition-transform duration-100 pixel-focus outline-none"
            )}
          >
            {slaying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                SUMMONING…
              </>
            ) : (
              <>
                <Swords className="w-4 h-4" aria-hidden />
                SLAY ALL DEMONS
              </>
            )}
          </button>
        )}
      </div>

      {/* ── All-Cleared victory banner — Tier B+ green chrome ── */}
      {allCleared && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", damping: 16, stiffness: 200 }}
          className="relative bg-slate-900/95 px-6 py-8 pixel-border text-green-500/80 text-center space-y-4"
        >
          {/* Pixel nail corners — green to match the victory state */}
          <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-green-400" />
          <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-green-400" />
          <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-green-400" />
          <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-green-400" />

          <div className="text-5xl">⚔️</div>
          <div className="space-y-2">
            <p className="font-pixel text-[9px] tracking-wider text-green-400/90">
              GRIMOIRE SEALED
            </p>
            <h2 className="text-xl font-bold text-green-400">All Demons Vanquished</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              Every demon in your grimoire has been conquered. Keep studying — new mistakes
              will appear here if you stumble again.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-5 py-2.5 font-pixel text-[10px] tracking-wider",
              "bg-green-500 text-white shadow-[0_4px_0_0_#14532d]",
              "hover:shadow-[0_2px_0_0_#14532d] hover:translate-y-0.5",
              "active:shadow-[0_0_0_0_#14532d] active:translate-y-1",
              "transition-transform duration-100 pixel-focus outline-none"
            )}
          >
            BACK TO DASHBOARD
          </button>
        </motion.div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rpg-card rounded-xl p-4 animate-pulse h-20 opacity-50" />
          ))}
        </div>
      )}

      {/* ── Empty state (truly empty — never had any demons) ── */}
      {!loading && data && data.demons.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-slate-900/95 px-6 py-16 pixel-border text-slate-700/60 flex flex-col items-center gap-4 text-center"
        >
          {/* Pixel nail corners — slate, matching the quiet/empty state */}
          <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-slate-700" />
          <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-slate-700" />
          <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-slate-700" />
          <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-slate-700" />

          <div className="text-5xl mb-2">✨</div>
          <p className="font-pixel text-[9px] tracking-wider text-slate-500/80">
            GRIMOIRE EMPTY
          </p>
          <h2 className="text-xl font-semibold text-white">No demons recorded</h2>
          <p className="text-slate-400 text-sm max-w-sm">
            Questions only appear here after you&apos;ve failed them twice. Keep studying and
            the grimoire will do the tracking for you.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className={cn(
              "mt-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 font-pixel text-[10px] tracking-wider",
              "bg-slate-800 text-slate-300 shadow-[0_4px_0_0_#0f172a]",
              "hover:shadow-[0_2px_0_0_#0f172a] hover:translate-y-0.5",
              "active:shadow-[0_0_0_0_#0f172a] active:translate-y-1",
              "transition-transform duration-100 pixel-focus outline-none"
            )}
          >
            <BookOpen className="w-4 h-4" aria-hidden />
            BACK TO DASHBOARD
          </button>
        </motion.div>
      )}

      {/* ── Demon list ── */}
      {!loading && data && data.demons.length > 0 && (
        <AnimatePresence>
          <div className="space-y-3">
            {data.demons.map((demon, idx) => (
              <motion.div
                key={demon.questionId}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <DemonCard demon={demon} />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* ── Legend ── */}
      {!loading && data && data.demons.length > 0 && (
        <p className="text-slate-600 text-xs text-center">
          Demons are settled (✓) once your most recent attempt scores ≥ 80%.
          They are removed when you no longer fail them.
        </p>
      )}
    </div>
  );
}

// ─── Demon card ──────────────────────────────────────────────────────────────

function DemonCard({ demon }: { demon: GrimoireDemon }) {
  const skulls = Math.min(demon.failCount, 5); // cap display at 5 skulls

  // State-color: settled → green; active → purple. Outer pixel-border,
  // nail corners, and chips all transition together.
  const borderTone = demon.isSettled ? "text-green-500/60" : "text-purple-500/70";
  const nailColor = demon.isSettled ? "bg-green-400/70" : "bg-purple-400";

  return (
    <div
      className={cn(
        "relative bg-slate-900/90 px-4 py-4 flex items-start gap-4 transition-colors duration-300",
        "pixel-border",
        borderTone,
        demon.isSettled && "opacity-75"
      )}
    >
      {/* Pixel nail corners — state-colored */}
      <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5", nailColor)} />
      <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5", nailColor)} />
      <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5", nailColor)} />
      <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5", nailColor)} />

      {/* Skull / settled icon */}
      <div className="mt-0.5 shrink-0">
        {demon.isSettled ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <Skull className="w-5 h-5 text-purple-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* `MarkdownInline` renders `$...$` LaTeX via KaTeX and stays inline-safe.
            `dir="auto"` lets Hebrew questions right-align naturally without
            forcing RTL on English ones. */}
        <p
          dir="auto"
          className="text-sm text-slate-200 line-clamp-2 leading-relaxed"
        >
          <MarkdownInline>{demon.content}</MarkdownInline>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {/* Topic chip — slate pixel-bordered */}
          <span className="inline-flex items-center px-2 py-0.5 pixel-border text-slate-400 text-[10px]">
            {demon.topicTitle}
          </span>
          {/* Type chip — pixel-bordered, state-colored to indigo (MCQ) or amber (Open) */}
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 pixel-border font-pixel text-[8px] tracking-wider",
              demon.type === "mcq" ? "text-indigo-400" : "text-amber-400"
            )}
          >
            {demon.type === "mcq" ? "MULTIPLE CHOICE" : "OPEN"}
          </span>
          {demon.isSettled && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 pixel-border font-pixel text-[8px] tracking-wider text-green-400">
              <CheckCircle className="w-2.5 h-2.5" aria-hidden />
              SETTLED
            </span>
          )}
        </div>
      </div>

      {/* Fail count */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <div className="flex gap-0.5">
          {Array.from({ length: skulls }).map((_, i) => (
            <span key={i} className={cn("text-sm", demon.isSettled ? "opacity-30" : "")}>
              💀
            </span>
          ))}
        </div>
        <span className="text-[10px] text-slate-500 font-pixel tracking-wider">
          {demon.failCount}× FAILED
        </span>
      </div>
    </div>
  );
}

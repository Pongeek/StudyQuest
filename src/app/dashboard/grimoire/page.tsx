"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, Swords, BookOpen, Loader2, Sparkles, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GrimoireDemon } from "@/app/api/grimoire/route";

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
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl transition-all ${
              allCleared
                ? "bg-green-950/60 border-green-700/40 glow-green"
                : "bg-purple-950/60 border-purple-700/40 glow-purple"
            }`}>
              {allCleared ? "✅" : "📕"}
            </div>
            <h1 className="text-3xl font-bold text-white">Mistake Grimoire</h1>
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

        {/* Only show the slay button when there are active unsettled demons */}
        {hasActiveDemons && (
          <Button
            onClick={handleSlay}
            disabled={slaying}
            className="bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/40 shadow-lg
                       disabled:opacity-50 gap-2 whitespace-nowrap"
          >
            {slaying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Swords className="w-4 h-4" />
            )}
            {slaying ? "Summoning session…" : "⚔️ Slay All Demons"}
          </Button>
        )}
      </div>

      {/* ── All-Cleared victory banner ── */}
      {allCleared && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", damping: 16, stiffness: 200 }}
          className="rpg-card rounded-2xl p-8 border border-green-700/40 bg-green-950/20 text-center space-y-4"
        >
          <div className="text-5xl">⚔️</div>
          <div>
            <h2 className="text-xl font-bold text-green-400">Grimoire Cleared!</h2>
            <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
              Every demon in your grimoire has been conquered. Keep studying — new mistakes
              will appear here if you stumble again.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-green-700/50 text-green-400 hover:bg-green-900/20"
            onClick={() => router.push("/dashboard")}
          >
            Back to Dashboard
          </Button>
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

      {/* ── Empty state ── */}
      {!loading && data && data.demons.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 gap-4 text-center"
        >
          <div className="text-5xl mb-2">✨</div>
          <h2 className="text-xl font-semibold text-white">Your grimoire is empty</h2>
          <p className="text-slate-400 text-sm max-w-sm">
            Questions only appear here after you&apos;ve failed them twice. Keep studying and
            the grimoire will do the tracking for you.
          </p>
          <Button
            variant="outline"
            className="mt-2 border-slate-700 text-slate-300"
            onClick={() => router.push("/dashboard")}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
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

  return (
    <div
      className={cn(
        "rpg-card rounded-xl p-4 border flex items-start gap-4 transition-all duration-200",
        demon.isSettled
          ? "border-green-800/30 bg-green-950/10 opacity-70"
          : "border-purple-900/40 hover:border-purple-700/60 hover:bg-purple-950/10"
      )}
    >
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
        <p className="text-sm text-slate-200 line-clamp-2 leading-relaxed">
          {demon.content}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
            {demon.topicTitle}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-xs uppercase tracking-wide",
              demon.type === "mcq"
                ? "border-indigo-700/50 text-indigo-400"
                : "border-amber-700/50 text-amber-400"
            )}
          >
            {demon.type === "mcq" ? "Multiple Choice" : "Open"}
          </Badge>
          {demon.isSettled && (
            <Badge className="text-xs bg-green-900/40 text-green-400 border-green-700/40">
              Settled ✓
            </Badge>
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
        <span className="text-xs text-slate-500">{demon.failCount}× failed</span>
      </div>
    </div>
  );
}

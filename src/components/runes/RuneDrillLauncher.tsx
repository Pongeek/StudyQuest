"use client";

import { useEffect, useRef, useState } from "react";
import { Gem, Loader2 } from "lucide-react";
import Link from "next/link";
import type { DrillCard } from "@/lib/runes-queue";
import RuneDrillEngine, { type DrillScope } from "./RuneDrillEngine";

interface RuneDrillLauncherProps {
  scope: DrillScope;
  topicId?: string;
  courseId?: string;
}

type LaunchState =
  | { status: "loading" }
  | { status: "ready"; sessionId: string; cards: DrillCard[]; totalInScope: number }
  | { status: "error"; message: string };

/**
 * Mount-time session starter (ReviewLauncher pattern): POST /api/runes/start,
 * then hand the cards to the engine. `attempt` re-keys the effect so the
 * summary's "Drill the rest" button can spin up a fresh session in place.
 *
 * Cram continuation: a cram deck can exceed one batch (RUNE_CRAM_BATCH), so
 * `seenRef` accumulates every card drilled in this chain and passes it as
 * `excludeIds` on each "Drill the rest" — the server then serves the next
 * fresh batch, and `cramRemaining` (total in scope minus drilled) tells the
 * summary whether to offer another round. Due scope ignores all of this; it
 * re-pulls the live queue each time.
 */
export default function RuneDrillLauncher({
  scope,
  topicId,
  courseId,
}: RuneDrillLauncherProps) {
  const [state, setState] = useState<LaunchState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // Cards drilled in EARLIER batches of this chain (excludes the current one
  // until the next restart). A ref so the effect reads it synchronously at
  // fire time without joining the dependency array; `seenCount` mirrors its
  // length for the render-time "remaining" math (refs can't be read in render).
  const seenRef = useRef<string[]>([]);
  const [seenCount, setSeenCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function startSession() {
      try {
        const res = await fetch("/api/runes/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope,
            topicId,
            courseId,
            excludeIds: scope === "due" ? undefined : seenRef.current,
          }),
        });
        if (cancelled) return;

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setState({ status: "error", message: data.error ?? "Failed to start the drill" });
          return;
        }

        const data = await res.json();
        setState({
          status: "ready",
          sessionId: data.sessionId,
          cards: data.cards,
          totalInScope: data.totalInScope ?? 0,
        });
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Network error. Please try again." });
        }
      }
    }

    startSession();
    return () => {
      cancelled = true;
    };
  }, [scope, topicId, courseId, attempt]);

  function restart() {
    // Bank the current batch's cards before fetching the next, so the server
    // skips them. (No-op effect for due scope, which ignores excludeIds.)
    if (state.status === "ready") {
      seenRef.current = [...seenRef.current, ...state.cards.map((c) => c.id)];
      setSeenCount(seenRef.current.length);
    }
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  }

  if (state.status === "loading") {
    return (
      <div className="max-w-lg mx-auto py-24 text-center space-y-6">
        <div className="relative mx-auto w-16 h-16">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Gem className="w-8 h-8 text-purple-400" />
          </div>
          <Loader2 className="absolute -bottom-1 -right-1 w-5 h-5 text-purple-400 animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="font-pixel text-purple-400 text-[10px] uppercase tracking-widest">
            Attuning
          </p>
          <p className="text-slate-400 text-sm">Drawing your runes&hellip;</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="max-w-lg mx-auto py-24 text-center space-y-4">
        <p className="text-red-400 font-semibold">{state.message}</p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={restart}
            className="text-sm text-slate-400 underline underline-offset-2 hover:text-white transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="text-sm text-slate-400 underline underline-offset-2 hover:text-white transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Cram cards still un-drilled after this batch (total minus already-banked
  // minus the batch in hand). Undefined for due scope — it uses remainingDue.
  const cramRemaining =
    scope === "due"
      ? undefined
      : Math.max(0, state.totalInScope - seenCount - state.cards.length);

  return (
    <RuneDrillEngine
      key={`${state.sessionId}`}
      sessionId={state.sessionId}
      scope={scope}
      cards={state.cards}
      cramRemaining={cramRemaining}
      onRestart={restart}
    />
  );
}

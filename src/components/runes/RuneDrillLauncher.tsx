"use client";

import { useEffect, useState } from "react";
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
  | { status: "ready"; sessionId: string; cards: DrillCard[] }
  | { status: "error"; message: string };

/**
 * Mount-time session starter (ReviewLauncher pattern): POST /api/runes/start,
 * then hand the cards to the engine. `attempt` re-keys the effect so the
 * summary's "Drill the rest" button can spin up a fresh session in place.
 */
export default function RuneDrillLauncher({
  scope,
  topicId,
  courseId,
}: RuneDrillLauncherProps) {
  const [state, setState] = useState<LaunchState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function startSession() {
      try {
        const res = await fetch("/api/runes/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, topicId, courseId }),
        });
        if (cancelled) return;

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setState({ status: "error", message: data.error ?? "Failed to start the drill" });
          return;
        }

        const data = await res.json();
        setState({ status: "ready", sessionId: data.sessionId, cards: data.cards });
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

  return (
    <RuneDrillEngine
      key={`${state.sessionId}`}
      sessionId={state.sessionId}
      scope={scope}
      cards={state.cards}
      onRestart={restart}
    />
  );
}

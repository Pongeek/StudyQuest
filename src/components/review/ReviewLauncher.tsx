"use client";

import { useEffect, useState } from "react";
import { Brain, Loader2 } from "lucide-react";
import ReviewEngine from "./ReviewEngine";

interface ReviewQuestion {
  id: string;
  type: "mcq" | "open";
  content: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  difficulty: number;
  topicId: string;
  topicTitle: string;
}

interface ReviewLauncherProps {
  userTotalXp: number;
  userStreak: number;
}

type LaunchState =
  | { status: "loading" }
  | { status: "ready"; sessionId: string; questions: ReviewQuestion[] }
  | { status: "error"; message: string };

export default function ReviewLauncher({ userTotalXp, userStreak }: ReviewLauncherProps) {
  const [state, setState] = useState<LaunchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function startSession() {
      try {
        const res = await fetch("/api/review/start", { method: "POST" });
        if (cancelled) return;

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setState({ status: "error", message: data.error ?? "Failed to start review" });
          return;
        }

        const data = await res.json();
        setState({ status: "ready", sessionId: data.sessionId, questions: data.questions });
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Network error. Please try again." });
        }
      }
    }

    startSession();
    return () => { cancelled = true; };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="max-w-lg mx-auto py-24 text-center space-y-6">
        <div className="relative mx-auto w-16 h-16">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Brain className="w-8 h-8 text-cyan-400" />
          </div>
          <Loader2 className="absolute -bottom-1 -right-1 w-5 h-5 text-cyan-400 animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="font-pixel text-cyan-400 text-[10px] uppercase tracking-widest">
            Calibrating
          </p>
          <p className="text-slate-400 text-sm">Preparing your review session&hellip;</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="max-w-lg mx-auto py-24 text-center space-y-4">
        <p className="text-red-400 font-semibold">{state.message}</p>
        <button
          onClick={() => setState({ status: "loading" })}
          className="text-sm text-slate-400 underline underline-offset-2 hover:text-white transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <ReviewEngine
      sessionId={state.sessionId}
      questions={state.questions}
      userTotalXp={userTotalXp}
      userStreak={userStreak}
    />
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, X, ArrowRight } from "lucide-react";

interface StreakWarningBannerProps {
  streak: number;
  /** href to the user's most-recent topic or /dashboard */
  href: string;
}

function getDismissKey(): string {
  // Key is date-scoped so it resets each day automatically
  const today = new Date().toISOString().slice(0, 10);
  return `streak-warning-dismissed-${today}`;
}

export default function StreakWarningBanner({
  streak,
  href,
}: StreakWarningBannerProps) {
  const [dismissed, setDismissed] = useState(true); // default hidden until hydrated

  useEffect(() => {
    // After hydration, check localStorage
    const key = getDismissKey();
    setDismissed(localStorage.getItem(key) === "1");
  }, []);

  const dismiss = () => {
    localStorage.setItem(getDismissKey(), "1");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/8 px-4 py-3 text-sm animate-bounce-in"
      role="alert"
    >
      {/* Flame icon */}
      <Flame
        className="w-5 h-5 text-orange-400 shrink-0 animate-fire-glow"
        aria-hidden
      />

      {/* Copy */}
      <p className="flex-1 text-orange-200 leading-snug min-w-0">
        <span className="text-orange-400" aria-hidden>
          ⚠️{" "}
        </span>
        Your{" "}
        <strong className="text-orange-300">{streak}-day</strong> streak ends
        at midnight! Take any quiz today to keep it alive.
      </p>

      {/* CTA */}
      <Link
        href={href}
        className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-orange-300 hover:text-orange-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-md px-1"
        onClick={dismiss}
      >
        Continue Quest
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        aria-label="Dismiss streak warning"
        className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface EpisodeSummary {
  id: string;
  title: string;
  total: number;
  completed: number;
}

/**
 * Sticky chapter breadcrumb shown at the top of the Course Map while the
 * user is scrolled inside a long episode. Hooks `#episode-card-{id}` via
 * IntersectionObserver — the topmost intersecting card (in episode order)
 * is the active chapter. Sticks via `.episode-breadcrumb` (top-16, just
 * below the dashboard nav). Returns null when nothing is active so it
 * doesn't take vertical space above the list.
 */
export default function EpisodeBreadcrumb({
  episodes,
}: {
  episodes: EpisodeSummary[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const intersectingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (episodes.length === 0) return;
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id.replace("episode-card-", "");
          if (entry.isIntersecting) intersectingRef.current.add(id);
          else intersectingRef.current.delete(id);
        }
        if (intersectingRef.current.size === 0) {
          setActiveId(null);
          return;
        }
        // Pick the topmost episode (earliest in the episodes array) that
        // is currently intersecting — gives a stable, document-ordered pick
        // during the brief overlap as one episode hands off to the next.
        const orderedFirst = episodes.find((ep) =>
          intersectingRef.current.has(ep.id)
        );
        setActiveId(orderedFirst?.id ?? null);
      },
      {
        // Thin band right under the dashboard nav. Only episodes whose body
        // crosses through this band trigger as active.
        rootMargin: "-64px 0px -85% 0px",
        threshold: 0,
      }
    );

    for (const ep of episodes) {
      const el = document.getElementById(`episode-card-${ep.id}`);
      if (el) observer.observe(el);
    }
    return () => {
      observer.disconnect();
      intersectingRef.current.clear();
    };
  }, [episodes]);

  if (!activeId) return null;
  const active = episodes.find((e) => e.id === activeId);
  if (!active) return null;
  const idx = episodes.findIndex((e) => e.id === activeId);
  const isComplete = active.total > 0 && active.completed === active.total;
  const pct =
    active.total > 0 ? Math.round((active.completed / active.total) * 100) : 0;

  // `fixed` keeps the breadcrumb out of document flow — sticky used to cause
  // a layout-shift feedback loop where mounting the bar pushed the active
  // episode out of the intersection band, which unmounted the bar, which
  // pushed the episode back in… the page visibly wobbled on scroll. The outer
  // wrapper handles positioning; inner element matches the dashboard's
  // `max-w-6xl + px-4 sm:px-6` container so the chip sits over the content.
  return (
    <div className="fixed top-16 inset-x-0 z-30 pointer-events-none px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div
          className={cn(
            "episode-breadcrumb px-4 py-2.5 flex items-center gap-3 pointer-events-auto",
            isComplete && "episode-breadcrumb--complete"
          )}
          aria-label={`Currently reading chapter ${idx + 1}: ${active.title}`}
        >
          <span
            className={cn(
              "font-pixel text-[9px] tracking-wider px-2 py-1 pixel-border flex-shrink-0",
              isComplete
                ? "text-emerald-400 bg-emerald-500/10"
                : "text-indigo-300 bg-indigo-500/10"
            )}
          >
            CH {String(idx + 1).padStart(2, "0")}
          </span>
          <span className="text-sm font-bold text-slate-200 truncate flex-1">
            {active.title}
          </span>
          <span className="text-xs text-slate-500 tabular-nums hidden sm:inline">
            {active.completed}/{active.total}
          </span>
          <span
            className={cn(
              "text-xs font-pixel tabular-nums flex-shrink-0",
              isComplete ? "text-emerald-400" : "text-indigo-300"
            )}
          >
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
}

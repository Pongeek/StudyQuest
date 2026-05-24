"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface EpisodeStatusRow {
  id: string;
  title: string;
  status: "processing" | "ready" | "error";
}

interface EpisodeProcessingPollerProps {
  courseId: string;
  /** Full episode list with statuses. The poller derives processingCount
   *  from this and also uses it to diff transitions between refreshes. */
  episodes: EpisodeStatusRow[];
}

/**
 * Polls the course page while any episode is still being processed by the
 * AI AND fires toasts when episodes finish (or fail).
 *
 * Behaviour:
 *   - Every 4s, calls `router.refresh()` so the server component re-runs
 *     and picks up DB status changes. Polling auto-stops when no episodes
 *     remain in `processing`.
 *   - On each render, compares the current statuses against the previous
 *     render's. If an episode transitioned `processing → ready`, fires a
 *     success toast. If `processing → error`, fires an error toast.
 *   - First render is the baseline — no toast for episodes already in any
 *     state at mount.
 *
 * Mounts a no-op when nothing is processing AND no transition just
 * happened, so the cost is zero in the common case (idle course view).
 */
export default function EpisodeProcessingPoller({
  episodes,
}: EpisodeProcessingPollerProps) {
  const router = useRouter();
  const prevStatusesRef = useRef<Map<string, EpisodeStatusRow["status"]> | null>(
    null
  );
  const processingCount = episodes.filter((e) => e.status === "processing").length;

  // Diff transitions on each render. First render only baselines — toasts
  // fire from the second render onward, after a poll-driven refresh.
  useEffect(() => {
    const prev = prevStatusesRef.current;
    const next = new Map<string, EpisodeStatusRow["status"]>();
    for (const ep of episodes) next.set(ep.id, ep.status);

    if (prev !== null) {
      for (const ep of episodes) {
        const prevStatus = prev.get(ep.id);
        if (prevStatus === "processing" && ep.status === "ready") {
          toast.success(`"${ep.title}" is ready — your topics await.`, {
            icon: "⚔",
            duration: 5000,
          });
        } else if (prevStatus === "processing" && ep.status === "error") {
          // Direct user to the FailedEpisodesBanner above the CourseMap
          // — it carries the specific reason (PDF too large, rate limit,
          // etc.) from `episodes.error_message`. A blanket "try
          // re-uploading" toast would just send them into the same loop
          // if the root cause is the PDF itself.
          toast.error(
            `Couldn't process "${ep.title}" — see the red banner above for details.`,
            { duration: 8000 }
          );
        }
      }
    }
    prevStatusesRef.current = next;
  }, [episodes]);

  // Polling: refresh every 4s while anything is still processing. Cap at 5
  // minutes — extraction shouldn't take longer than that even for big PDFs.
  useEffect(() => {
    if (processingCount === 0) return;

    let stopped = false;
    let elapsed = 0;
    const intervalMs = 4000;
    const maxElapsedMs = 5 * 60 * 1000;

    const tick = () => {
      if (stopped) return;
      router.refresh();
      elapsed += intervalMs;
      if (elapsed >= maxElapsedMs) {
        stopped = true;
      }
    };

    const id = setInterval(tick, intervalMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingCount]);

  return null;
}

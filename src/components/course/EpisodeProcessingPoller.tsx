"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface EpisodeProcessingPollerProps {
  courseId: string;
  /** Number of episodes currently in 'processing' status when the page rendered */
  processingCount: number;
}

/**
 * Polls the course page while any episode is still being processed by the AI.
 * Every 4 seconds it calls `router.refresh()` which re-runs the server
 * component — picking up status changes (processing → ready/error) without
 * the user having to manually reload.
 *
 * Mounts a no-op when nothing is processing, so the cost is zero in the
 * common case (idle course view).
 */
export default function EpisodeProcessingPoller({
  courseId,
  processingCount,
}: EpisodeProcessingPollerProps) {
  const router = useRouter();

  useEffect(() => {
    if (processingCount === 0) return;

    let stopped = false;
    let elapsed = 0;
    const intervalMs = 4000;
    // Safety: stop polling after 5 minutes — extraction shouldn't take longer
    // than this even for big PDFs. After that the user should refresh manually.
    const maxElapsedMs = 5 * 60 * 1000;

    const tick = () => {
      if (stopped) return;
      router.refresh();
      elapsed += intervalMs;
      if (elapsed >= maxElapsedMs) {
        stopped = true;
        return;
      }
    };

    const id = setInterval(tick, intervalMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // We deliberately depend only on processingCount — if it goes to 0 the
    // effect cleans up. courseId is stable per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingCount]);

  return null;
}

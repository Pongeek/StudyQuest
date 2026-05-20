"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DeleteEpisodeButtonProps {
  episodeId: string;
  episodeTitle: string;
  /** Counts shown in the body so the user knows what they're losing. */
  topicCount?: number;
  /** Size variant — "icon" is the compact trash icon used inside the
   *  CourseMap episode header. "label" shows trash + text. */
  variant?: "icon" | "label";
  /** Optional className for the trigger button. */
  className?: string;
}

/**
 * Lightweight confirm dialog for removing a single episode.
 *
 * Less heavy than `DeleteCourseDialog` (no type-to-confirm) because the
 * blast radius is smaller — one chapter's worth of topics, not the whole
 * course. The user can always re-upload the episode PDF if they regret it.
 */
export default function DeleteEpisodeButton({
  episodeId,
  episodeTitle,
  topicCount,
  variant = "icon",
  className,
}: DeleteEpisodeButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/episodes/${episodeId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Could not delete episode");
      }
      toast.success(`Episode "${episodeTitle}" removed.`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete episode");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Prevent the click from bubbling up to the episode header (which
          // is itself a clickable collapse toggle in CourseMap).
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        aria-label={`Delete episode ${episodeTitle}`}
        className={cn(
          "inline-flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/[0.06] text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-colors",
          variant === "icon" ? "w-8 h-8" : "px-3 py-1.5 gap-2 text-xs font-semibold",
          className
        )}
      >
        <Trash2 className={variant === "icon" ? "w-3.5 h-3.5" : "w-3.5 h-3.5"} />
        {variant === "label" && <span>Delete</span>}
      </button>

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="sm:max-w-md border-red-500/20 bg-slate-950">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="text-white text-base">Remove this episode?</DialogTitle>
                <DialogDescription className="text-slate-400 text-xs mt-1">
                  The rest of your course stays intact.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-3.5 py-3">
              <p className="text-sm font-semibold text-white truncate" title={episodeTitle}>
                {episodeTitle}
              </p>
              {typeof topicCount === "number" && (
                <p className="text-xs text-slate-400 mt-1">
                  <span className="text-slate-200 font-semibold tabular-nums">{topicCount}</span>{" "}
                  topic{topicCount === 1 ? "" : "s"} and their mastery progress will be lost.
                </p>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              The episode&apos;s PDF, generated topics, quiz history, and boss fight will be removed.
              You can re-upload it later, but progress won&apos;t come back.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="border-slate-700/50 text-slate-300 hover:bg-white/5"
            >
              Keep it
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold gap-2"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Removing…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Remove episode
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

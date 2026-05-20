"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Skull, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface DeleteCourseDialogProps {
  courseId: string;
  /** Display name of the course (used for the type-to-confirm check) */
  courseName: string;
  /** Optional summary numbers shown in the dialog body to convey the
   *  weight of what's being deleted. */
  stats?: {
    episodes?: number;
    topics?: number;
    sessions?: number;
  };
}

/**
 * GitHub-style "type the repository name to delete" confirmation modal.
 * Used for permanently removing a course and all of its episodes, topics,
 * questions, and progress history.
 *
 * Deliberately heavy: this protects against accidental deletion when the
 * user has weeks/months of study progress on a course.
 */
export default function DeleteCourseDialog({
  courseId,
  courseName,
  stats,
}: DeleteCourseDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  // Confirmation requires the user to type the course name exactly.
  // Comparison is case-insensitive and ignores surrounding whitespace so
  // tiny formatting differences don't block them indefinitely.
  const canConfirm = typed.trim().toLowerCase() === courseName.trim().toLowerCase();

  const handleDelete = async () => {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Could not delete");
      }
      toast.success(`"${courseName}" banished from your realm.`);
      setOpen(false);
      // Navigate back to the dashboard — the course we're sitting on no
      // longer exists, so we can't stay on this page.
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      setBusy(false);
    }
  };

  const closeAndReset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setTyped("");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={closeAndReset}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-red-500/25 bg-red-500/[0.06] text-red-400 hover:bg-red-500/10 hover:border-red-500/40 text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete course
          </button>
        }
      />

      <DialogContent className="sm:max-w-md border-red-500/20 bg-slate-950">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center shrink-0">
              <Skull className="w-5 h-5 text-red-400" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-white text-base">Banish this course?</DialogTitle>
              <DialogDescription className="text-slate-400 text-xs mt-1">
                This cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning callout — quantifies what's being lost */}
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3.5 py-3 flex items-start gap-2.5 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="text-slate-300 leading-relaxed">
              <p>You&apos;ll permanently lose:</p>
              <ul className="mt-1.5 space-y-0.5 text-slate-400 text-xs list-disc list-inside marker:text-red-400/60">
                {typeof stats?.episodes === "number" && (
                  <li>
                    <span className="text-slate-200 font-semibold tabular-nums">
                      {stats.episodes}
                    </span>{" "}
                    episode{stats.episodes === 1 ? "" : "s"}
                  </li>
                )}
                {typeof stats?.topics === "number" && (
                  <li>
                    <span className="text-slate-200 font-semibold tabular-nums">
                      {stats.topics}
                    </span>{" "}
                    topic{stats.topics === 1 ? "" : "s"} and all mastery progress
                  </li>
                )}
                {typeof stats?.sessions === "number" && stats.sessions > 0 && (
                  <li>
                    <span className="text-slate-200 font-semibold tabular-nums">
                      {stats.sessions}
                    </span>{" "}
                    completed quiz{stats.sessions === 1 ? "" : "zes"} and their answers
                  </li>
                )}
                <li>All boss-fight history, exam practice, and uploaded PDFs</li>
              </ul>
            </div>
          </div>

          {/* Type-to-confirm */}
          <div className="space-y-2">
            <label htmlFor="delete-course-confirm" className="text-xs text-slate-400 font-medium">
              Type{" "}
              <span className="text-red-300 font-bold">
                {courseName}
              </span>{" "}
              below to confirm
            </label>
            <Input
              id="delete-course-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-600 focus-visible:ring-red-500/50 focus-visible:border-red-500/50"
              placeholder={courseName}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => closeAndReset(false)}
            disabled={busy}
            className="border-slate-700/50 text-slate-300 hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={!canConfirm || busy}
            className="bg-red-600 hover:bg-red-500 text-white font-semibold gap-2 disabled:opacity-50 disabled:hover:bg-red-600"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Banishing…
              </>
            ) : (
              <>
                <Skull className="w-4 h-4" />
                Banish course
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

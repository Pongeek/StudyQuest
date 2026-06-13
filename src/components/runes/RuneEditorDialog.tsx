"use client";

import { useState } from "react";
import { Gem, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MarkdownContent from "@/components/quiz/MarkdownContent";
import { MAX_BACK_CHARS, MAX_FRONT_CHARS, type RuneCardDto } from "@/lib/rune-deck";

interface RuneEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "edit" | "add";
  topicId: string;
  /** Required in edit mode. */
  card?: Pick<RuneCardDto, "id" | "front" | "back"> | null;
  dir?: "ltr" | "rtl" | "auto";
  /** Edit mode receives the patched fields; add mode the full new card. */
  onSaved: (card: Partial<RuneCardDto> & { id: string }) => void;
}

/**
 * One dialog for both "edit this rune" and "add my own rune". Front/back
 * textareas with a live Markdown+KaTeX preview so Hebrew + LaTeX cards can
 * be checked before saving. Editing a forged card stamps edited_at server-
 * side, which makes it survive Reforge.
 */
export default function RuneEditorDialog({
  open,
  onOpenChange,
  mode,
  topicId,
  card,
  dir = "auto",
  onSaved,
}: RuneEditorDialogProps) {
  // Seeded once per mount — the parent renders this component only while
  // open, so every open is a fresh mount seeded from the current target.
  const [front, setFront] = useState(() =>
    mode === "edit" ? (card?.front ?? "") : "",
  );
  const [back, setBack] = useState(() =>
    mode === "edit" ? (card?.back ?? "") : "",
  );
  const [busy, setBusy] = useState(false);

  const canSave =
    front.trim().length > 0 &&
    back.trim().length > 0 &&
    front.length <= MAX_FRONT_CHARS &&
    back.length <= MAX_BACK_CHARS;

  async function save() {
    if (busy || !canSave) return;
    setBusy(true);
    try {
      const res =
        mode === "add"
          ? await fetch("/api/runes/cards", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ topicId, front: front.trim(), back: back.trim() }),
            })
          : await fetch(`/api/runes/cards/${card!.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ front: front.trim(), back: back.trim() }),
            });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error || "Couldn't save the rune — try again.");
        return;
      }
      const data = await res.json();
      onSaved(data.card);
      toast.success(mode === "add" ? "Rune added to the deck." : "Rune updated.");
      onOpenChange(false);
    } catch {
      toast.error("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  const showPreview = front.trim().length > 0 || back.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg border-purple-500/20 bg-slate-950 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center shrink-0">
              <Gem className="w-5 h-5 text-purple-400" />
            </div>
            <div className="min-w-0 text-left">
              <DialogTitle className="text-white text-base">
                {mode === "add" ? "Inscribe a new rune" : "Edit rune"}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs mt-1">
                {mode === "add"
                  ? "Your own card — it survives every Reforge."
                  : "Edited runes survive Reforge."}
                {" Markdown + LaTeX ($...$, $$...$$) render below."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="rune-front"
              className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5"
            >
              Front — the prompt
            </label>
            <textarea
              id="rune-front"
              dir={dir}
              value={front}
              onChange={(e) => setFront(e.target.value)}
              rows={2}
              maxLength={MAX_FRONT_CHARS}
              placeholder='e.g. "Define ε-closure of a state set R"'
              className="w-full rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-y"
            />
          </div>

          <div>
            <label
              htmlFor="rune-back"
              className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5"
            >
              Back — the answer
            </label>
            <textarea
              id="rune-back"
              dir={dir}
              value={back}
              onChange={(e) => setBack(e.target.value)}
              rows={4}
              maxLength={MAX_BACK_CHARS}
              placeholder="The definition / statement / fact. Keep it to a few lines."
              className="w-full rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-y"
            />
          </div>

          {showPreview && (
            <div className="rounded-lg border border-purple-500/15 bg-purple-500/[0.04] px-3.5 py-3">
              <p className="font-pixel text-[8px] tracking-wider text-purple-300/80 mb-2">
                PREVIEW
              </p>
              {front.trim() && (
                <div dir={dir} className="text-sm text-slate-200">
                  <MarkdownContent>{front}</MarkdownContent>
                </div>
              )}
              {front.trim() && back.trim() && (
                <div className="my-2 h-px bg-purple-500/15" />
              )}
              {back.trim() && (
                <div dir={dir} className="text-sm text-slate-300">
                  <MarkdownContent>{back}</MarkdownContent>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="border-slate-700/50 text-slate-300 hover:bg-white/5 min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={busy || !canSave}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold gap-2 min-h-[44px]"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : mode === "add" ? (
              "Add rune"
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

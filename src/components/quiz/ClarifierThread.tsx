"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import MarkdownContent from "@/components/quiz/MarkdownContent";
import { readClassifiedErrorFromResponse } from "@/lib/ai-error";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { INLINE_COPY } from "@/lib/loading-copy";

type Role = "user" | "assistant";
type Message = { role: Role; content: string };

interface ClarifierThreadProps {
  answerKind: "quiz" | "review";
  answerId: string;
  dir?: "ltr" | "rtl" | "auto";
  onClose: () => void;
}

/**
 * Inline "Why was I wrong?" chat. Mounts when the user taps the
 * "Help me understand" button in QuizEngine's feedback block. Opens
 * (or resumes) a clarifier session against /api/clarify, then runs up to
 * three model turns under normal use. "I get it" always closes; on close
 * the parent collapses the thread (which may render a one-line chip).
 *
 * Soft-cap UX: after the 3rd assistant message the textarea picks up an
 * amber nudge to wrap up. The thread still accepts more turns — the cap
 * is enforced server-side via SESSION_OUTPUT_TOKEN_CAP, not here.
 */
export default function ClarifierThread({
  answerKind,
  answerId,
  dir = "auto",
  onClose,
}: ClarifierThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [opening, setOpening] = useState(true);
  const [closedByBudget, setClosedByBudget] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Count assistant turns for the soft-cap nudge.
  const assistantTurns = messages.filter((m) => m.role === "assistant").length;
  const showSoftCap = assistantTurns >= 3 && !closedByBudget;

  useEffect(() => {
    // Open / resume the session on mount.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clarify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answerKind, answerId }),
        });
        if (!res.ok) {
          const cls = await readClassifiedErrorFromResponse(res);
          toast.error(cls?.userMessage ?? "Couldn't open the clarifier.");
          setOpening(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setMessages(data.messages ?? []);
        if (data.closed) setClosedByBudget(true);
      } catch {
        toast.error("Network hiccup opening the clarifier — try again.");
      } finally {
        if (!cancelled) setOpening(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [answerKind, answerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || sending || closedByBudget) return;
    setSending(true);
    // Optimistic append of the user turn so the UI feels live.
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setDraft("");
    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerKind, answerId, message: text }),
      });
      if (!res.ok) {
        const cls = await readClassifiedErrorFromResponse(res);
        toast.error(cls?.userMessage ?? "Loremaster failed to respond — try again.");
        // Roll back the optimistic append so user can retry.
        setMessages((prev) => prev.slice(0, -1));
        setDraft(text);
        return;
      }
      const data = await res.json();
      setMessages(data.messages ?? []);
      if (data.closed) setClosedByBudget(true);
    } catch {
      toast.error("Network hiccup — try again.");
      setMessages((prev) => prev.slice(0, -1));
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 pixel-border bg-slate-950/60 p-4" dir={dir}>
      <div className="flex items-center justify-between mb-3">
        <p className="font-pixel text-[9px] tracking-wider text-indigo-400">
          LOREMASTER · CLARIFY
        </p>
        <button
          type="button"
          onClick={onClose}
          className="pixel-chip px-2.5 py-1 font-pixel text-[8px] tracking-wider text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 inline-flex items-center gap-1.5"
        >
          <Check className="w-3 h-3" />
          I GET IT
        </button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-72 overflow-y-auto space-y-3 mb-3 scrollbar-hide"
      >
        {opening && messages.length === 0 && (
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {INLINE_COPY.clarifier}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "rounded-lg px-3 py-2 text-sm leading-relaxed",
              m.role === "user"
                ? "bg-indigo-500/10 border border-indigo-500/20 ml-6"
                : "bg-white/[0.03] border border-white/[0.06] mr-6",
            )}
          >
            <MarkdownContent>{m.content}</MarkdownContent>
          </div>
        ))}
        {sending && (
          <div className="mr-6 flex items-center gap-1.5 text-slate-500">
            <span
              className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
              style={{ animationDelay: "120ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
              style={{ animationDelay: "240ms" }}
            />
          </div>
        )}
      </div>

      {showSoftCap && !closedByBudget && (
        <p className="font-pixel text-[8px] tracking-wider text-amber-400/80 mb-2">
          WRAP THIS UP — TRY A ONE-LINER IN YOUR OWN WORDS →
        </p>
      )}

      {closedByBudget ? (
        <p className="text-xs text-slate-500">
          Reached the end of this clarifier — close it and open a fresh one if you need more.
        </p>
      ) : (
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            dir="auto"
            rows={2}
            disabled={opening || sending}
            placeholder="Tell the Loremaster what's unclear…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                send();
              }
            }}
            className="flex-1 bg-slate-950/80 border border-white/[0.08] rounded-md px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 resize-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim() || sending || opening}
            className="pixel-chip self-end px-3 py-2 font-pixel text-[9px] tracking-wider text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            SEND
          </button>
        </div>
      )}
    </div>
  );
}

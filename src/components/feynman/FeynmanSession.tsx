"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles, ArrowLeft, RotateCcw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSound } from "@/lib/useSound";
import { XPBurstProvider, useXPBurst } from "@/components/effects/XPBurst";
import { toast } from "sonner";
import { INLINE_COPY } from "@/lib/loading-copy";

/** Detects Hebrew/Arabic so message bubbles get dir="rtl". */
function isRTL(text: string): boolean {
  return /[֐-׿؀-ۿ]/.test(text);
}

type Phase = "chat" | "evaluating" | "result";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface EvaluationResult {
  passed: boolean;
  score: number;
  feedback: string;
  xpEarned: number;
  newAchievements: Array<{ slug: string; name: string; icon: string; description: string; xp_reward: number }>;
}

interface FeynmanSessionProps {
  sessionId: string;
  topicTitle: string;
  courseId: string;
  topicId: string;
  initialMessages: Message[];
}

// ─── Inner component (needs XPBurstProvider above) ───────────────────────────

function FeynmanSessionInner({
  sessionId,
  topicTitle,
  courseId,
  topicId,
  initialMessages,
}: FeynmanSessionProps) {
  const router = useRouter();
  const { play } = useSound();
  const { fireBurst } = useXPBurst();

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(0); // number of student messages sent
  const [canEvaluate, setCanEvaluate] = useState(false);
  const [phase, setPhase] = useState<Phase>("chat");
  const [result, setResult] = useState<EvaluationResult | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/feynman/sessions/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) throw new Error("Failed to get reply");
      const data = await res.json();

      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      setTurnCount(data.turnCount);
      setCanEvaluate(data.canEvaluate);
    } catch {
      toast.error("Failed to get a reply. Please try again.");
      // Remove the optimistic user message on failure
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      // Refocus the textarea
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [input, isLoading, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEvaluate = async () => {
    if (phase !== "chat") return;
    setPhase("evaluating");

    try {
      const res = await fetch(`/api/feynman/sessions/${sessionId}/evaluate`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Evaluation failed");
      const data: EvaluationResult = await res.json();
      setResult(data);
      setPhase("result");

      if (data.passed) {
        play("xp", "big");
        setTimeout(() => play("achievement"), 400);
        fireBurst({ amount: data.xpEarned });
      } else {
        play("wrong");
      }
    } catch {
      toast.error("Evaluation failed. Please try again.");
      setPhase("chat");
    }
  };

  const handleGoBack = () => {
    router.push(`/dashboard/courses/${courseId}/topics/${topicId}`);
  };

  const handleRetry = () => {
    // Navigate to start a fresh feynman session (the CTA will create a new one)
    router.push(`/dashboard/courses/${courseId}/topics/${topicId}`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[800px] max-w-2xl mx-auto">

      {/* ── Header — pixel-border avatar tile + pixel-font eyebrow ── */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button
          onClick={handleGoBack}
          className="text-slate-400 hover:text-white transition-colors p-1"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div
          className="w-10 h-10 pixel-border text-purple-500/80 bg-purple-500/15 flex items-center justify-center text-lg shrink-0"
          aria-hidden
        >
          🎓
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-pixel text-[9px] tracking-wider text-purple-400/90 mb-0.5">
            FEYNMAN MODE
          </p>
          <p className="text-xs text-slate-400 truncate">{topicTitle}</p>
        </div>
        {turnCount > 0 && (
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 pixel-border font-pixel text-[8px] tracking-wider shrink-0 transition-colors duration-200",
              canEvaluate ? "text-amber-400" : "text-slate-400"
            )}
          >
            EXCHANGE {turnCount}
          </span>
        )}
      </div>

      {/* ── Message thread ── */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "assistant" && (
                <div
                  className="w-8 h-8 pixel-border text-purple-500/70 bg-purple-500/15 flex items-center justify-center text-sm shrink-0 mt-0.5"
                  aria-hidden
                >
                  🎓
                </div>
              )}
              <div
                dir={isRTL(msg.content) ? "rtl" : "ltr"}
                style={{ unicodeBidi: "plaintext" }}
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-indigo-600/30 border border-indigo-500/30 text-slate-100 rounded-tr-sm"
                    : "bg-slate-800/70 border border-slate-700/50 text-slate-200 rounded-tl-sm"
                )}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div
                  className="w-8 h-8 pixel-border text-indigo-500/70 bg-indigo-500/15 flex items-center justify-center text-sm shrink-0 mt-0.5"
                  aria-hidden
                >
                  👤
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3 justify-start"
          >
            <div
              className="w-8 h-8 pixel-border text-purple-500/70 bg-purple-500/15 flex items-center justify-center text-sm shrink-0"
              aria-hidden
            >
              🎓
            </div>
            <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-2 items-center h-4">
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                    />
                  ))}
                </div>
                <span className="text-xs text-slate-400">{INLINE_COPY.feynmanTurn}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Evaluation result — Tier B+ with state-driven chrome (green on pass, red on fail) */}
        <AnimatePresence>
          {phase === "result" && result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 16, stiffness: 200 }}
              className={cn(
                "relative bg-slate-900/95 px-6 py-6 pixel-border text-center space-y-4 transition-colors duration-300",
                result.passed ? "text-green-500/80" : "text-red-500/80"
              )}
            >
              {/* Pixel nail corners — state-colored (green on pass / red on fail) */}
              <span
                aria-hidden
                className={cn(
                  "absolute top-1.5 left-1.5 w-1.5 h-1.5 transition-colors duration-300",
                  result.passed ? "bg-green-400" : "bg-red-400"
                )}
              />
              <span
                aria-hidden
                className={cn(
                  "absolute top-1.5 right-1.5 w-1.5 h-1.5 transition-colors duration-300",
                  result.passed ? "bg-green-400" : "bg-red-400"
                )}
              />
              <span
                aria-hidden
                className={cn(
                  "absolute bottom-1.5 left-1.5 w-1.5 h-1.5 transition-colors duration-300",
                  result.passed ? "bg-green-400" : "bg-red-400"
                )}
              />
              <span
                aria-hidden
                className={cn(
                  "absolute bottom-1.5 right-1.5 w-1.5 h-1.5 transition-colors duration-300",
                  result.passed ? "bg-green-400" : "bg-red-400"
                )}
              />

              <div className="text-4xl">{result.passed ? "🎉" : "📖"}</div>
              <div className="space-y-2">
                <p
                  className={cn(
                    "font-pixel text-[9px] tracking-wider",
                    result.passed ? "text-green-400/90" : "text-red-400/90"
                  )}
                >
                  {result.passed ? "UNDERSTANDING CONFIRMED" : "KEEP TEACHING"}
                </p>
                <h3 className={cn("text-lg font-bold", result.passed ? "text-green-400" : "text-slate-200")}>
                  {result.passed ? "You passed!" : "Almost there — try again"}
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">{result.feedback}</p>
              </div>

              {/* XP earned — amber stays amber (XP semantic), not green */}
              <div className="inline-flex items-center gap-2 px-3 py-1 pixel-border text-amber-400">
                <span className="font-pixel text-[10px] tracking-wider">+{result.xpEarned} XP</span>
                {result.passed && <span className="text-[10px] text-slate-400 font-pixel">EARNED</span>}
              </div>

              {/* Achievement(s) */}
              {result.newAchievements.length > 0 && (
                <div className="flex flex-col items-center gap-1">
                  {result.newAchievements.map((a) => (
                    <div
                      key={a.slug}
                      className="flex items-center gap-2 bg-amber-500/10 px-3 py-1.5 pixel-border text-amber-500/80"
                    >
                      <span>{a.icon}</span>
                      <span className="font-pixel text-[9px] tracking-wider text-amber-400">
                        {a.name.toUpperCase()} UNLOCKED
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons — chunky pixel-shadow */}
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
                {result.passed ? (
                  <button
                    onClick={() => { router.refresh(); handleGoBack(); }}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 px-5 py-2.5 font-pixel text-[10px] tracking-wider",
                      "bg-green-500 text-white shadow-[0_4px_0_0_#14532d]",
                      "hover:shadow-[0_2px_0_0_#14532d] hover:translate-y-0.5",
                      "active:shadow-[0_0_0_0_#14532d] active:translate-y-1",
                      "transition-transform duration-100 pixel-focus outline-none"
                    )}
                  >
                    <Sparkles className="w-4 h-4" aria-hidden />
                    BACK TO TOPIC
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleRetry}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 px-5 py-2.5 font-pixel text-[10px] tracking-wider",
                        "bg-slate-800 text-slate-300 shadow-[0_4px_0_0_#0f172a]",
                        "hover:shadow-[0_2px_0_0_#0f172a] hover:translate-y-0.5",
                        "active:shadow-[0_0_0_0_#0f172a] active:translate-y-1",
                        "transition-transform duration-100 pixel-focus outline-none"
                      )}
                    >
                      <RotateCcw className="w-4 h-4" aria-hidden />
                      TRY AGAIN
                    </button>
                    <button
                      onClick={() => { router.refresh(); handleGoBack(); }}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 px-5 py-2.5 font-pixel text-[10px] tracking-wider",
                        "bg-indigo-500 text-white shadow-[0_4px_0_0_#312e81]",
                        "hover:shadow-[0_2px_0_0_#312e81] hover:translate-y-0.5",
                        "active:shadow-[0_0_0_0_#312e81] active:translate-y-1",
                        "transition-transform duration-100 pixel-focus outline-none"
                      )}
                    >
                      BACK TO TOPIC
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      {phase === "chat" && (
        <div className="shrink-0 mt-4 space-y-2">
          {/* Evaluate button — shows after 3 turns. Chunky amber pixel-shadow CTA. */}
          <AnimatePresence>
            {canEvaluate && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <button
                  onClick={handleEvaluate}
                  disabled={phase !== "chat"}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-2 px-5 py-3 font-pixel text-[10px] tracking-wider",
                    "bg-amber-500 text-slate-950 shadow-[0_4px_0_0_#78350f]",
                    "hover:shadow-[0_2px_0_0_#78350f] hover:translate-y-0.5",
                    "active:shadow-[0_0_0_0_#78350f] active:translate-y-1",
                    "disabled:opacity-50 disabled:translate-y-0 disabled:shadow-[0_4px_0_0_#78350f]",
                    "transition-transform duration-100 pixel-focus outline-none"
                  )}
                >
                  <Sparkles className="w-4 h-4" aria-hidden />
                  AM I READY? EVALUATE →
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message input */}
          <div className="flex gap-2 items-end">
            <Textarea
              dir="auto"
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isLoading
                  ? "Waiting for reply…"
                  : "Explain the concept… (Enter to send, Shift+Enter for new line)"
              }
              disabled={isLoading}
              rows={2}
              className="flex-1 resize-none bg-slate-900/60 border-slate-700/60 text-slate-100
                         placeholder:text-slate-600 focus:border-indigo-500/60 rounded-xl text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              aria-label="Send"
              className={cn(
                "inline-flex items-center justify-center h-10 px-4 font-pixel text-[10px] tracking-wider",
                "bg-indigo-500 text-white shadow-[0_4px_0_0_#312e81]",
                "hover:shadow-[0_2px_0_0_#312e81] hover:translate-y-0.5",
                "active:shadow-[0_0_0_0_#312e81] active:translate-y-1",
                "disabled:opacity-40 disabled:translate-y-0 disabled:shadow-[0_4px_0_0_#312e81]",
                "transition-transform duration-100 pixel-focus outline-none"
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Helper hint */}
          {!canEvaluate && turnCount < 3 && (
            <p className="text-xs text-slate-600 text-center">
              {3 - turnCount} more exchange{3 - turnCount !== 1 ? "s" : ""} needed before evaluation
            </p>
          )}
        </div>
      )}

      {phase === "evaluating" && (
        <div className="shrink-0 mt-4 flex items-center justify-center gap-3 py-4">
          <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
          <span className="text-amber-400 text-sm">Evaluating your explanation…</span>
        </div>
      )}
    </div>
  );
}

// ─── Public export — wraps with XPBurstProvider ───────────────────────────────

export default function FeynmanSession(props: FeynmanSessionProps) {
  return (
    <XPBurstProvider>
      <FeynmanSessionInner {...props} />
    </XPBurstProvider>
  );
}

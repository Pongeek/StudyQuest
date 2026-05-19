"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSound } from "@/lib/useSound";
import { XPBurstProvider, useXPBurst } from "@/components/effects/XPBurst";
import { toast } from "sonner";

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

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button
          onClick={handleGoBack}
          className="text-slate-400 hover:text-white transition-colors p-1"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-700/40 flex items-center justify-center text-lg glow-purple">
          🎓
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-white truncate">Feynman Mode</h1>
          <p className="text-xs text-slate-400 truncate">{topicTitle}</p>
        </div>
        {turnCount > 0 && (
          <Badge
            variant="outline"
            className={cn(
              "text-xs shrink-0 border-slate-700 transition-colors",
              canEvaluate ? "border-amber-700/60 text-amber-400" : "text-slate-400"
            )}
          >
            Exchange {turnCount}
          </Badge>
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
                <div className="w-8 h-8 rounded-full bg-purple-950/60 border border-purple-700/40 flex items-center justify-center text-sm shrink-0 mt-0.5">
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
                <div className="w-8 h-8 rounded-full bg-indigo-950/60 border border-indigo-700/40 flex items-center justify-center text-sm shrink-0 mt-0.5">
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
            <div className="w-8 h-8 rounded-full bg-purple-950/60 border border-purple-700/40 flex items-center justify-center text-sm shrink-0">
              🎓
            </div>
            <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Evaluation result */}
        <AnimatePresence>
          {phase === "result" && result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 16, stiffness: 200 }}
              className={cn(
                "rpg-card rounded-2xl p-6 border text-center space-y-4",
                result.passed
                  ? "border-green-700/40 bg-green-950/20"
                  : "border-red-800/30 bg-red-950/10"
              )}
            >
              <div className="text-4xl">
                {result.passed ? "🎉" : "📖"}
              </div>
              <div>
                <h3 className={cn("text-lg font-bold", result.passed ? "text-green-400" : "text-slate-200")}>
                  {result.passed ? "You passed! Understanding confirmed." : "Keep studying — you'll get there."}
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed mt-2">{result.feedback}</p>
              </div>

              {/* XP earned */}
              <div className="flex items-center justify-center gap-2">
                <span className="text-amber-400 font-bold text-lg">+{result.xpEarned} XP</span>
                {result.passed && <span className="text-xs text-slate-400">earned</span>}
              </div>

              {/* Achievement(s) */}
              {result.newAchievements.length > 0 && (
                <div className="flex flex-col items-center gap-1">
                  {result.newAchievements.map((a) => (
                    <div key={a.slug} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5">
                      <span>{a.icon}</span>
                      <span className="text-amber-400 text-xs font-semibold">{a.name} unlocked!</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
                {result.passed ? (
                  <Button
                    className="bg-green-600 hover:bg-green-500 text-white gap-2"
                    onClick={() => { router.refresh(); handleGoBack(); }}
                  >
                    <Sparkles className="w-4 h-4" />
                    Back to Topic
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="border-slate-700 text-slate-300 gap-2"
                      onClick={handleRetry}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Try Again
                    </Button>
                    <Button
                      onClick={() => { router.refresh(); handleGoBack(); }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      Back to Topic
                    </Button>
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
          {/* Evaluate button — shows after 3 turns */}
          <AnimatePresence>
            {canEvaluate && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <Button
                  onClick={handleEvaluate}
                  disabled={phase !== "chat"}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white gap-2 border border-amber-500/40"
                >
                  <Sparkles className="w-4 h-4" />
                  Am I ready? Evaluate my explanation →
                </Button>
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
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white h-10 px-3 rounded-xl"
              aria-label="Send"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
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

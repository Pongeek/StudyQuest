"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Zap, RotateCcw, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const QUESTION = {
  stem: "What does a study RPG do that flashcards don't?",
  options: [
    { letter: "A", text: "Memorize definitions through repetition" },
    {
      letter: "B",
      text: "Show progression through XP, levels, and a course map — making study feel like a journey",
    },
    { letter: "C", text: "Replace your textbook entirely" },
    { letter: "D", text: "Use spaced repetition only" },
  ],
  correct: "B",
};

type AnswerState = "idle" | "correct" | "wrong";

export default function LandingQuizDemo() {
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [state, setState] = useState<AnswerState>("idle");

  const handleSelect = (letter: string) => {
    if (answered) return;
    setSelected(letter);
  };

  const handleSubmit = () => {
    if (!selected || answered) return;
    setAnswered(true);
    setState(selected === QUESTION.correct ? "correct" : "wrong");
  };

  const handleReset = () => {
    setSelected(null);
    setAnswered(false);
    setState("idle");
  };

  const isCorrect = state === "correct";

  return (
    <section className="container mx-auto px-6 py-20 max-w-2xl">
      {/* Section header */}
      <div className="text-center mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">
          Live Demo
        </p>
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
          A Taste of Combat
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
          Here&apos;s what answering a question feels like. Click an option below.
        </p>
      </div>

      {/* Quiz card */}
      <div className="rpg-card rounded-2xl p-6 sm:p-8 space-y-5">
        {/* Type badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-400">
            Multiple Choice
          </span>
          <span className="text-xs text-slate-600 font-medium">Q1</span>
        </div>

        {/* Question stem */}
        <p className="text-white text-base sm:text-lg font-semibold leading-snug">
          {QUESTION.stem}
        </p>

        {/* Options */}
        <div className="space-y-2.5">
          {QUESTION.options.map(({ letter, text }) => {
            let optionState: "default" | "selected" | "correct" | "wrong" =
              "default";
            if (answered) {
              if (letter === QUESTION.correct) optionState = "correct";
              else if (letter === selected && letter !== QUESTION.correct)
                optionState = "wrong";
            } else if (letter === selected) {
              optionState = "selected";
            }

            return (
              <button
                key={letter}
                disabled={answered}
                onClick={() => handleSelect(letter)}
                className={cn(
                  "w-full px-4 py-3 sm:px-5 sm:py-4 rounded-xl border transition-all duration-200 text-sm text-left flex items-start gap-3",
                  optionState === "default" &&
                    "border-slate-700/50 bg-slate-800/30 text-slate-300 hover:border-indigo-500/50 hover:bg-indigo-500/5 hover:text-white",
                  optionState === "selected" &&
                    "border-indigo-500/60 bg-indigo-600/15 text-white",
                  optionState === "correct" &&
                    "border-green-500/60 bg-green-500/10 text-green-300 glow-green",
                  optionState === "wrong" &&
                    "border-red-500/60 bg-red-500/10 text-red-300 glow-red animate-shake",
                  answered &&
                    optionState === "default" &&
                    "opacity-40 cursor-not-allowed"
                )}
              >
                <span className="font-mono text-xs opacity-50 mt-0.5 flex-shrink-0">
                  {letter}.
                </span>
                <span>{text}</span>
              </button>
            );
          })}
        </div>

        {/* Submit / feedback */}
        <div className="pt-1 space-y-4">
          {!answered ? (
            <Button
              onClick={handleSubmit}
              disabled={!selected}
              className="bg-indigo-500 hover:bg-indigo-400 text-white font-medium px-8 gap-2 transition-colors duration-150"
            >
              <Swords className="w-4 h-4" />
              Submit Answer
            </Button>
          ) : (
            <AnimatePresence>
              <motion.div
                key="feedback"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-xl p-5 space-y-3 border animate-score-burst",
                  isCorrect
                    ? "bg-green-500/10 border-green-500/20"
                    : "bg-red-500/10 border-red-500/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        "font-bold text-sm",
                        isCorrect ? "text-green-300" : "text-red-300"
                      )}
                    >
                      {isCorrect ? "Correct!" : "Not quite right"}
                    </span>
                  </div>

                  {/* XP pill — only shows on correct */}
                  {isCorrect && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        delay: 0.25,
                        type: "spring",
                        damping: 12,
                      }}
                      className="flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full"
                    >
                      <Zap className="w-3 h-3" />
                      +25 XP
                    </motion.span>
                  )}
                </div>

                <p className="text-sm text-slate-300">
                  {isCorrect
                    ? "StudyQuest layers XP, levels, course maps, and boss fights on top of practice questions — turning isolated flashcard drill into a motivating academic journey."
                    : "The correct answer is B. StudyQuest adds XP, levels, a visual course map, and boss fights that make study feel like progression, not repetition."}
                </p>

                {!isCorrect && (
                  <div className="pt-3 border-t border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">
                      Correct answer
                    </p>
                    <p className="text-sm text-white">
                      B. Show progression through XP, levels, and a course map
                      — making study feel like a journey
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {answered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <button
                onClick={handleReset}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors duration-150"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Try again
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Upsell nudge */}
      <p className="text-center text-xs text-slate-600 mt-6">
        In the real app, open-answer questions are graded by AI with personalised feedback.
      </p>
    </section>
  );
}

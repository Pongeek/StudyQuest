"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Zap, RotateCcw, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSound } from "@/lib/useSound";
import {
  clamp01,
  r,
  win,
  makeShards,
  useReducedMotionPref,
  useScrubOn,
} from "@/components/landing/scrub";

// ─── Assembly entrance ───────────────────────────────────────────────────────
// The card materializes from pixel shards as the section rises into view —
// the narrative inverse of Chapter 01's PDF disintegration. Driven by the
// shared --p scrub var (see scrub.ts); --d = 1 - p flips the shard field
// from "scattered" to "assembled" as you scroll. Fully reversible.

const TRIAL_SHARDS = makeShards(6, 8);

/** Entry progress: 0 with the section top at the viewport bottom, 1 once it
 *  has risen to ~38% of the viewport. */
const trialEntry = (rect: DOMRect, vh: number) => clamp01((vh - rect.top) / (vh * 0.62));

// ─── Question pool ────────────────────────────────────────────────────────────
// A handful of study-themed MCQs. The landing demo picks one at random on
// mount and offers a "Next question" cycle after the first answer so a
// repeat visitor sees a different prompt every time.
//
// Keep prompts SHORT and one-glance scannable — landing UX, not a real exam.
// Each `winCopy` / `loseCopy` is shown in the feedback panel so the demo
// reads as a tiny tutorial moment rather than just "right / wrong."

interface DemoQuestion {
  stem: string;
  options: { letter: string; text: string }[];
  correct: string;
  winCopy: string;
  loseCopy: string;
}

const QUESTIONS: DemoQuestion[] = [
  {
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
    winCopy:
      "StudyQuest layers XP, levels, course maps, and boss fights on top of practice questions — turning isolated flashcard drill into a motivating academic journey.",
    loseCopy:
      "Flashcards drill recall. StudyQuest adds XP, levels, a visual course map, and boss fights so study feels like progression, not repetition.",
  },
  {
    stem: "What's the point of the Mistake Grimoire?",
    options: [
      { letter: "A", text: "Track which questions you've spent the most time on" },
      { letter: "B", text: "Show you a leaderboard of your weakest topics" },
      {
        letter: "C",
        text: "Collect every question you've missed twice into a list you can drill in one session",
      },
      { letter: "D", text: "Generate harder questions automatically" },
    ],
    correct: "C",
    winCopy:
      "Right. Miss a question twice and it becomes a 'demon' in the Grimoire. One tap on 'Slay All' creates a targeted review session — no more mistakes buried in old logs.",
    loseCopy:
      "Close, but the Grimoire is your collection of repeatedly-missed questions. Open it, tap 'Slay All Demons', and drill them in one focused session.",
  },
  {
    stem: "Why does StudyQuest schedule reviews using spaced repetition (SM-2)?",
    options: [
      { letter: "A", text: "It's faster than re-reading the textbook" },
      {
        letter: "B",
        text: "It surfaces topics right before you'd forget them — interrupting the forgetting curve",
      },
      { letter: "C", text: "Because all study apps do it" },
      { letter: "D", text: "To increase XP rewards" },
    ],
    correct: "B",
    winCopy:
      "Exactly. Each topic has its own next-review-date that shifts based on your score. Ace a topic → it comes back in weeks. Bomb it → tomorrow.",
    loseCopy:
      "Spaced repetition targets the forgetting curve. Topics resurface right before recall would decay, so each review cements the learning instead of starting over.",
  },
  {
    stem: "What happens when an episode boss is defeated?",
    options: [
      { letter: "A", text: "Nothing — it just unlocks the next chapter" },
      {
        letter: "B",
        text: "You earn a large XP burst, a passed achievement, and the boss tile permanently changes state on the course map",
      },
      { letter: "C", text: "Your streak resets" },
      { letter: "D", text: "The boss respawns weekly" },
    ],
    correct: "B",
    winCopy:
      "Bosses are the comprehensive end-of-episode quiz. Beat one → big XP, achievement unlock, the arena tile flips from 'dormant' to 'defeated' for good.",
    loseCopy:
      "Defeating a boss is a milestone moment — big XP, a Boss Slayer achievement, and the tile permanently changes state on the course map.",
  },
  {
    stem: "What's Feynman Mode for?",
    options: [
      { letter: "A", text: "A timed exam practice mode" },
      { letter: "B", text: "Generating flashcards from a topic summary" },
      {
        letter: "C",
        text: "Teaching a concept back to an AI peer who only asks questions and never gives the answer",
      },
      { letter: "D", text: "Tracking how many hours you've studied" },
    ],
    correct: "C",
    winCopy:
      "Right. After a failed topic quiz, Feynman Mode opens a chat where Claude plays a curious peer who only asks 'why?' and 'what if?' — you earn XP when you can explain it cold.",
    loseCopy:
      "Feynman Mode is a teach-back chat. The AI never gives you the answer — it only asks clarifying questions. You earn XP when you can explain the concept yourself.",
  },
];

type AnswerState = "idle" | "correct" | "wrong";

function pickRandomQuestion(prev?: DemoQuestion): DemoQuestion {
  // Avoid showing the same question twice in a row — pick from a pool
  // that excludes the previous one. With 5 questions this still feels
  // pleasantly random.
  if (!prev || QUESTIONS.length <= 1) {
    return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  }
  const others = QUESTIONS.filter((q) => q !== prev);
  return others[Math.floor(Math.random() * others.length)];
}

export default function LandingQuizDemo() {
  const sectionRef = useRef<HTMLElement>(null);
  // Reduced-motion users get the section pre-assembled (--p pinned to 1).
  const reduceMotion = useReducedMotionPref();
  useScrubOn(sectionRef, trialEntry, reduceMotion);

  // Pick a stable question for the first render to avoid hydration mismatch:
  // server renders QUESTIONS[0], client swaps to random right after mount
  // (deferred to a timeout callback so the effect body itself doesn't set
  // state — react-hooks/set-state-in-effect).
  const [question, setQuestion] = useState<DemoQuestion>(QUESTIONS[0]);
  useEffect(() => {
    const id = setTimeout(() => setQuestion(pickRandomQuestion()), 0);
    return () => clearTimeout(id);
  }, []);

  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [state, setState] = useState<AnswerState>("idle");

  // Audio — same Web Audio synth the dashboard engines use, so the
  // landing demo feels like the real app. Respects the user's mute
  // toggle persisted in localStorage from any prior dashboard visit.
  const { play } = useSound();

  const handleSelect = (letter: string) => {
    if (answered) return;
    setSelected(letter);
  };

  const handleSubmit = () => {
    if (!selected || answered) return;
    setAnswered(true);
    const wasCorrect = selected === question.correct;
    setState(wasCorrect ? "correct" : "wrong");
    // Tiny dopamine hit / soft "not quite" ping. The XP chime layers on
    // top of "correct" for a richer right-answer moment, matching the
    // quiz engine's two-sound pattern.
    if (wasCorrect) {
      play("correct");
      play("xp", "normal");
    } else {
      play("wrong");
    }
  };

  const handleReset = () => {
    setSelected(null);
    setAnswered(false);
    setState("idle");
  };

  // "Next question" — pull a fresh random prompt from the pool and reset
  // the demo so a curious visitor can answer several in a row.
  const handleNext = () => {
    setQuestion((prev) => pickRandomQuestion(prev));
    handleReset();
  };

  const isCorrect = state === "correct";

  // Cache the question count for the footer text so the message can't
  // drift if QUESTIONS is edited mid-session.
  const questionPoolSize = useMemo(() => QUESTIONS.length, []);

  return (
    <section
      ref={sectionRef}
      style={{ ["--p" as string]: 0 }}
      className="container mx-auto px-6 py-20 max-w-2xl relative"
    >
      {/* Arena glow — a contained indigo light pool behind the demo card so
          the section reads as a lit stage. Brightens as the card assembles. */}
      <div
        aria-hidden
        className="absolute -inset-x-24 top-16 bottom-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 75% 60% at 50% 55%, rgba(99, 102, 241, 0.13), transparent 70%)",
          opacity: `calc(0.35 + var(--p) * 0.65)`,
        }}
      />
      {/* Section header — eyebrow → H2 → caption cascade, scrubbed by --p */}
      <div className="text-center mb-10">
        <p
          style={{
            opacity: `calc(${r(0.12, 0.35)})`,
            transform: `translateY(calc((1 - ${r(0.12, 0.35)}) * 14px))`,
          }}
          className="font-pixel text-[9px] tracking-wider text-indigo-400 mb-3"
        >
          CHAPTER 02 &middot; THE TRIAL
        </p>
        <h2
          style={{
            opacity: `calc(${r(0.18, 0.42)})`,
            transform: `translateY(calc((1 - ${r(0.18, 0.42)}) * 18px))`,
          }}
          className="text-3xl md:text-4xl font-bold mb-4 text-white"
        >
          A Taste of Combat
        </h2>
        <p
          style={{
            opacity: `calc(${r(0.24, 0.48)})`,
            transform: `translateY(calc((1 - ${r(0.24, 0.48)}) * 14px))`,
          }}
          className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto"
        >
          Here&apos;s what answering a question feels like — sound and all. Click an
          option, submit, and roll a new one.
        </p>
      </div>

      {/* Card + shard assembly field. The overlay sits OUTSIDE the card so
          shards can fly beyond its bounds without being clipped. */}
      <div className="relative">
        {/* Ignition flash — one indigo pulse as the assembly lands */}
        <div
          aria-hidden
          style={{ opacity: `calc(${win(0.8, 0.92, 0.92, 1)} * 0.5)` }}
          className="absolute -inset-3 bg-indigo-400/40 blur-2xl pointer-events-none"
        />

        {/* Quiz card — pixel-bordered with indigo nails; materializes late in
            the assembly so the shards appear to build it */}
        <div
          style={{
            ["--alive-rgb" as string]: "99 102 241",
            opacity: `calc(${r(0.55, 0.82)})`,
            transform: `translateY(calc((1 - ${r(0.5, 0.82)}) * 24px)) scale(calc(0.96 + ${r(0.5, 0.82)} * 0.04))`,
          }}
          className="relative rpg-card card-alive widget-elev rounded-2xl p-6 sm:p-8 space-y-5 overflow-hidden"
        >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
        <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
        <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
        <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
        <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />

        {/* Type badge */}
        <div className="relative z-[1] flex items-center gap-2">
          <span className="font-pixel text-[9px] tracking-wider px-2 py-1 pixel-border bg-blue-500/10 text-blue-400 inline-flex items-center">
            MULTIPLE CHOICE
          </span>
          <span className="font-pixel text-[9px] tracking-wider text-slate-600">Q1</span>
        </div>

        {/* Question stem — keyed by stem text so a swap re-runs the
            entrance animation, signaling "fresh prompt" visually. */}
        <AnimatePresence mode="wait">
          <motion.p
            key={question.stem}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="text-white text-base sm:text-lg font-semibold leading-snug"
          >
            {question.stem}
          </motion.p>
        </AnimatePresence>

        {/* Options */}
        <div className="space-y-2.5">
          {question.options.map(({ letter, text }) => {
            let optionState: "default" | "selected" | "correct" | "wrong" =
              "default";
            if (answered) {
              if (letter === question.correct) optionState = "correct";
              else if (letter === selected && letter !== question.correct)
                optionState = "wrong";
            } else if (letter === selected) {
              optionState = "selected";
            }

            return (
              <button
                key={`${question.stem}-${letter}`}
                disabled={answered}
                onClick={() => handleSelect(letter)}
                className={cn(
                  "w-full px-4 py-3 sm:px-5 sm:py-4 pixel-border transition-all duration-200 text-sm text-left flex items-start gap-3 relative",
                  optionState === "default" &&
                    "bg-slate-800/30 text-slate-500/60 hover:text-indigo-500/80 hover:bg-indigo-500/5",
                  optionState === "selected" &&
                    "bg-indigo-600/15 text-indigo-500/80",
                  optionState === "correct" &&
                    "bg-green-500/10 text-green-500/80 glow-green",
                  optionState === "wrong" &&
                    "bg-red-500/10 text-red-500/80 glow-red animate-shake",
                  answered &&
                    optionState === "default" &&
                    "opacity-40 cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "font-pixel text-[11px] tracking-wider mt-0.5 flex-shrink-0",
                    optionState === "default" && "text-slate-500/70",
                    optionState === "selected" && "text-indigo-300",
                    optionState === "correct" && "text-green-300",
                    optionState === "wrong" && "text-red-300"
                  )}
                >
                  {letter}
                </span>
                <span
                  className={cn(
                    optionState === "default" && "text-slate-300",
                    optionState === "selected" && "text-white",
                    optionState === "correct" && "text-green-200",
                    optionState === "wrong" && "text-red-200"
                  )}
                >
                  {text}
                </span>
              </button>
            );
          })}
        </div>

        {/* Submit / feedback */}
        <div className="pt-1 space-y-4">
          {!answered ? (
            <div className={cn(
              "inline-block transition-transform duration-100",
              selected && "hover:translate-y-0.5 active:translate-y-1"
            )}>
              <button
                onClick={handleSubmit}
                disabled={!selected}
                className={cn(
                  "px-6 py-3 flex items-center gap-2 font-pixel text-[11px] tracking-wider",
                  selected
                    ? "bg-indigo-500 text-white shadow-[0_4px_0_0_#312e81] hover:shadow-[0_2px_0_0_#312e81] active:shadow-[0_0_0_0_#312e81]"
                    : "bg-slate-800 text-slate-600 shadow-[0_4px_0_0_#0f172a] cursor-not-allowed opacity-60"
                )}
              >
                <Swords className="w-4 h-4" />
                SUBMIT ANSWER
              </button>
            </div>
          ) : (
            <AnimatePresence>
              <motion.div
                key="feedback"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-5 space-y-3 pixel-border animate-score-burst",
                  isCorrect
                    ? "bg-green-500/10 text-green-500/80"
                    : "bg-red-500/10 text-red-500/80"
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
                      className="inline-flex items-center gap-1 pixel-border bg-amber-500/10 text-amber-400 px-2.5 py-1"
                    >
                      <Zap className="w-3 h-3" />
                      <span className="font-pixel text-[10px] tracking-wider">+25 XP</span>
                    </motion.span>
                  )}
                </div>

                <p className="text-sm text-slate-300">
                  {isCorrect ? question.winCopy : question.loseCopy}
                </p>

                {!isCorrect && (
                  <div className="pt-3 border-t border-slate-700/50">
                    <p className="font-pixel text-[9px] tracking-wider text-slate-500 mb-1">
                      CORRECT ANSWER
                    </p>
                    <p className="text-sm text-white">
                      {question.correct}.{" "}
                      {question.options.find((o) => o.letter === question.correct)?.text}
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
              className="flex items-center gap-4 flex-wrap"
            >
              <button
                onClick={handleNext}
                className={cn(
                  "px-5 py-2.5 inline-flex items-center gap-2 font-pixel text-[10px] tracking-wider",
                  "bg-amber-500 text-slate-950 shadow-[0_4px_0_0_#78350f]",
                  "hover:shadow-[0_2px_0_0_#78350f] hover:translate-y-0.5",
                  "active:shadow-[0_0_0_0_#78350f] active:translate-y-1",
                  "transition-transform duration-100",
                )}
              >
                <Swords className="w-3.5 h-3.5" />
                NEXT QUESTION
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors duration-150"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Try this one again
              </button>
            </motion.div>
          )}
        </div>
        </div>

        {/* Shard field — converges into the card as --p → 1 (--d = 1 - p
            flips the canonical disintegration into an assembly) */}
        <div
          aria-hidden
          style={{ ["--d" as string]: `calc(1 - var(--p))` }}
          className="absolute inset-0 pointer-events-none"
        >
          {TRIAL_SHARDS.map((s, i) => (
            <span
              key={i}
              className={cn("absolute", s.tone)}
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.w}%`,
                height: `${s.h}%`,
                transform: `translate(calc(var(--d) * ${s.dx}px), calc(var(--d) * ${s.dy}px)) rotate(calc(var(--d) * ${s.rot}deg)) scale(calc(1 - var(--d) * 0.6))`,
                opacity: `calc(clamp(0, var(--d) * 14, 1) * (0.95 - var(--d)))`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Upsell nudge */}
      <p
        style={{ opacity: `calc(${r(0.6, 0.85)})` }}
        className="text-center text-xs text-slate-600 mt-6"
      >
        {questionPoolSize} demo questions in the pool. In the real app,
        open-answer questions are graded by AI with personalised feedback —
        and you can attach hand-drawn diagrams.
      </p>
    </section>
  );
}

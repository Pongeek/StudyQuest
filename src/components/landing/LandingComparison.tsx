import { Zap } from "lucide-react";
import AnimatedCounter from "@/components/effects/AnimatedCounter";

const OLD_ITEMS = [
  { emoji: "📖", text: "Re-read notes until they blur" },
  { emoji: "🖊️", text: "Highlight everything, remember nothing" },
  { emoji: "😰", text: "Pray before the exam" },
  { emoji: "🤷", text: "Hope for the best" },
  { emoji: "❓", text: "No idea where you stand" },
];

const NEW_ITEMS = [
  { text: "Upload once, AI builds your quest map" },
  { text: "Answer questions, earn XP for every attempt" },
  { text: "Track mastery level per topic in real time" },
  { text: "Boss fight unlocks when you're ready" },
  { text: "Walk into the exam knowing your score" },
];

export default function LandingComparison() {
  return (
    <section className="container mx-auto px-6 py-20 max-w-5xl">
      <div className="text-center mb-14">
        <p className="font-pixel text-[9px] tracking-wider text-indigo-400 mb-3">
          WHY THIS HITS DIFFERENT
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Old Way vs. Quest Way
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Old way — muted slate, nail-less to convey "the dead path" */}
        <div className="rpg-card rounded-2xl p-7 space-y-4 opacity-75 relative overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1 hover:opacity-90 hover:shadow-[0_18px_44px_-14px_rgba(100,116,139,0.35)]">
          {/* Slate accent line + nails (muted) */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-600/30 to-transparent" />
          <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-slate-600 z-[1]" />
          <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-slate-600 z-[1]" />
          <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-slate-600 z-[1]" />
          <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-slate-600 z-[1]" />

          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 pixel-border bg-slate-700/40 text-slate-500 flex items-center justify-center text-sm">
              😩
            </div>
            <div className="min-w-0">
              <div className="font-pixel text-[9px] tracking-wider text-slate-500/90">
                OLD WAY
              </div>
              <h3 className="font-bold text-slate-400 text-base">How You Study Now</h3>
            </div>
          </div>

          <ul className="space-y-3">
            {OLD_ITEMS.map(({ emoji, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-500">
                <span className="text-base w-5 text-center flex-shrink-0">{emoji}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <div className="pt-4 border-t border-slate-800/60">
            <div className="font-pixel text-[9px] tracking-wider text-slate-600 mb-1">
              PREDICTED SCORE
            </div>
            <span className="text-slate-500 text-sm">¯\_(ツ)_/¯</span>
          </div>
        </div>

        {/* Quest way — gold-tier card with amber pixel-nails */}
        <div className="rpg-card-gold rounded-2xl p-7 space-y-4 relative overflow-hidden transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_22px_56px_-16px_rgba(245,158,11,0.45)]">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
          <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
          <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
          <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
          <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />

          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 pixel-border bg-indigo-500 text-white flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-pixel text-[9px] tracking-wider text-amber-400/90">
                QUEST WAY
              </div>
              <h3 className="font-bold text-white text-base">With StudyQuest</h3>
            </div>
          </div>

          <ul className="space-y-3">
            {NEW_ITEMS.map(({ text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-slate-300">
                <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <div className="pt-4 border-t border-amber-500/20">
            <div className="font-pixel text-[9px] tracking-wider text-amber-400/90 mb-1">
              PREDICTED SCORE
            </div>
            <AnimatedCounter
              value={87}
              suffix="%"
              format={false}
              duration={1.4}
              delay={0.3}
              className="font-pixel text-[18px] tracking-wider text-amber-300 tabular-nums"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

import { Zap } from "lucide-react";

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
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">
          Why This Hits Different
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Old Way vs. Quest Way
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Old way */}
        <div className="rpg-card rounded-2xl p-7 space-y-4 opacity-75">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-slate-700/50 rounded-lg flex items-center justify-center text-sm">
              😩
            </div>
            <h3 className="font-bold text-slate-400 text-base">How You Study Now</h3>
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
            <p className="text-xs text-slate-600 font-medium">
              Predicted exam score: <span className="text-slate-500">¯\_(ツ)_/¯</span>
            </p>
          </div>
        </div>

        {/* New way */}
        <div className="rpg-card-gold rounded-2xl p-7 space-y-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-white text-base">How You&apos;ll Study with StudyQuest</h3>
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
            <p className="text-xs text-amber-400 font-bold">
              Predicted exam score:{" "}
              <span className="text-amber-300 text-sm font-extrabold">87%</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

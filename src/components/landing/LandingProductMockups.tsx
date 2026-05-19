import { Skull, Zap, Play, CheckCircle, Lock, Star, Trophy } from "lucide-react";

// ─── Shared micro-utility ────────────────────────────────────────────────────

function MiniXpBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className="h-full xp-shimmer rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Dashboard mock ──────────────────────────────────────────────────────────

function DashboardMock() {
  return (
    <div className="space-y-3">
      {/* Welcome bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            Welcome back
          </p>
          <p className="text-xs font-bold text-white mt-0.5">Scholar</p>
        </div>
        {/* Hex badge */}
        <div
          className="game-badge w-10 h-10"
          aria-label="Level 3"
        >
          <span className="text-base font-extrabold tabular-nums text-amber-300">3</span>
        </div>
      </div>

      {/* XP bar */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>XP</span>
          <span className="text-amber-400 font-bold">210/300</span>
        </div>
        <MiniXpBar pct={70} />
      </div>

      {/* Mini quest card */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
        <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center flex-shrink-0">
          <Zap className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-white truncate">Continue Quest</p>
          <p className="text-[9px] text-slate-400 truncate">Photosynthesis · 2 questions left</p>
        </div>
      </div>
    </div>
  );
}

// ─── Course map mock ─────────────────────────────────────────────────────────

function MapMock() {
  const topics = [
    { title: "Cell Biology", mastery: 5, icon: <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />, color: "text-amber-400", border: "border-amber-400/30 bg-amber-950/20" },
    { title: "Photosynthesis", mastery: 2, icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />, color: "text-emerald-400", border: "border-green-500/25 bg-green-950/20" },
    { title: "Genetics", mastery: 0, icon: <Play className="w-3 h-3 text-indigo-400" />, color: "text-indigo-400", border: "border-slate-700/40 bg-slate-900/50" },
    { title: "Ecosystems", mastery: -1, icon: <Lock className="w-3 h-3 text-slate-600" />, color: "text-slate-600", border: "border-slate-800/30 bg-slate-900/20 opacity-40" },
  ];

  return (
    <div className="space-y-1.5">
      {/* Episode header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center text-xs font-extrabold text-white flex-shrink-0">
          1
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-white truncate">Episode 1 · Biology</p>
          <MiniXpBar pct={50} />
        </div>
      </div>

      {topics.map((t) => (
        <div
          key={t.title}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${t.border}`}
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white/[0.04] border border-white/[0.07] flex-shrink-0">
            {t.icon}
          </div>
          <p className={`text-[10px] font-semibold truncate ${t.color}`}>{t.title}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Boss fight mock ─────────────────────────────────────────────────────────

function BossMock() {
  return (
    <div className="space-y-3">
      {/* Boss tile */}
      <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-red-500/20 bg-red-950/10">
        <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Skull className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-extrabold text-white">Episode Boss Fight</p>
          <p className="text-[10px] text-slate-400 mt-0.5">13 trials · All topics</p>
        </div>
      </div>

      {/* Boss HP bar */}
      <div>
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-slate-500">Boss HP</span>
          <span className="text-red-400 font-bold">100%</span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full bg-red-600 rounded-full w-full" />
        </div>
      </div>

      {/* Engage button */}
      <button className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors duration-150">
        <Skull className="w-3.5 h-3.5" />
        Engage Boss
      </button>

      <p className="text-[9px] text-slate-600 text-center">Complete all topics to unlock</p>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

const mockups = [
  {
    title: "Dashboard",
    caption: "Your dashboard",
    component: <DashboardMock />,
  },
  {
    title: "Course Map",
    caption: "Course map",
    component: <MapMock />,
  },
  {
    title: "Boss Fight",
    caption: "Boss fight",
    component: <BossMock />,
  },
];

export default function LandingProductMockups() {
  return (
    <section className="container mx-auto px-6 py-20">
      <div className="text-center mb-14">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">
          Product Preview
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          See What You&apos;re Walking Into
        </h2>
        <p className="text-slate-400 max-w-md mx-auto text-sm">
          Three surfaces, one coherent adventure. Your dashboard, your map, and the boss fight waiting at the end.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {mockups.map(({ title, caption, component }) => (
          <div
            key={title}
            className="group flex flex-col gap-3"
          >
            <div className="rpg-card rounded-2xl p-5 tilt-card sparkle-hover flex-1">
              {/* Mini window chrome */}
              <div className="flex items-center gap-1.5 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                <span className="ml-2 text-[9px] text-slate-600 font-medium uppercase tracking-wider">
                  {title}
                </span>
              </div>

              {/* Mock content */}
              {component}
            </div>

            {/* Caption */}
            <p className="text-xs text-slate-500 text-center font-medium">{caption}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

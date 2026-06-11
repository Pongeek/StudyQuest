"use client";

// ─── LandingScrollQuest ──────────────────────────────────────────────────────
// Two cinematic scroll-scrubbed chapters. Each chapter is a tall wrapper with
// a sticky full-viewport stage inside; scroll position through the wrapper IS
// the animation timeline (fully reversible — scrub up and the scene rewinds).
//
//   Chapter 01 · FORGE  — a PDF disintegrates into pixels and a course map
//                         draws itself node-by-node under your thumb.
//   Chapter 03 · BOSS   — the episode boss's HP drains as answer cards land
//                         hits, ending in a white-flash VICTORY slam.
//
// (Chapter 02 · THE TRIAL is the existing interactive LandingQuizDemo,
//  re-labeled in its own file so the page reads as one continuous quest.)
//
// ── Architecture: ONE scroll listener per chapter writes a single `--p`
// custom property (0→1) on the sticky stage. Every scrubbed visual is a pure
// CSS calc()/clamp() expression of var(--p) — zero per-element JS, zero
// animation-library subscriptions. (First build used framer-motion useScroll +
// useTransform; its style subscriptions silently died under React 19 +
// Turbopack dev, freezing mid-scrub. CSS-var scrubbing has no subscriptions
// to lose.) The only imperative writes besides --p are two text counters,
// updated in the same rAF.

import {
  FileText,
  Cpu,
  Braces,
  Layers,
  Infinity as InfinityIcon,
  Skull,
  Trophy,
  Zap,
  CheckCircle,
  Swords,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clamp01,
  r,
  win,
  makeShards,
  useReducedMotionPref,
  useStageScrub,
} from "@/components/landing/scrub";

/** Copy block that fades in (and optionally back out) over scrub windows. */
function Fade({
  appear,
  vanish,
  className,
  children,
}: {
  appear: [number, number];
  vanish?: [number, number];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        opacity: vanish
          ? `calc(${r(...appear)} * (1 - ${r(...vanish)}))`
          : `calc(${r(...appear)})`,
        transform: `translateY(calc((1 - ${r(...appear)}) * 18px))`,
      }}
      className={className}
    >
      {children}
    </div>
  );
}

/** Bottom-of-stage HUD: chapter label, scrub bar, live percent counter. */
function StageHud({ label, tone = "amber" }: { label: string; tone?: "amber" | "red" }) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-8 flex items-center gap-4">
      <span
        className={cn(
          "font-pixel text-[8px] tracking-[0.2em] whitespace-nowrap",
          tone === "red" ? "text-red-400/80" : "text-amber-400/80",
        )}
      >
        {label}
      </span>
      <div className="flex-1 h-1.5 pixel-border text-slate-700/70 bg-white/[0.04] overflow-hidden">
        <div
          className={cn("h-full", tone === "red" ? "bg-red-500" : "bg-amber-400")}
          style={{ width: "calc(var(--p) * 100%)" }}
        />
      </div>
      <span
        data-pct
        className={cn(
          "font-pixel text-[9px] tracking-wider tabular-nums w-10 text-right",
          tone === "red" ? "text-red-400" : "text-amber-400",
        )}
      >
        0%
      </span>
    </div>
  );
}

/** Shared onFrame: write the HUD percent counter. */
function writePct(p: number, stage: HTMLDivElement) {
  const el = stage.querySelector("[data-pct]");
  if (el) el.textContent = `${Math.round(p * 100)}%`;
}

// ═══════════════════════ CHAPTER 01 — FORGE ════════════════════════════════

// PDF shard field — deterministic scatter offsets (SSR-safe, see scrub.ts).
const SHARDS = makeShards(6, 9);

// Course map nodes — Max's actual Automata course flavor. xPct/yPct position
// over the SVG path; `at` is the scrub point where the node ignites.
const MAP_NODES = [
  { label: "Finite Automata", Icon: Cpu, at: 0.42, xPct: 16, yPct: 8, tone: "text-emerald-400", chip: "border-emerald-500/40 bg-emerald-950/60" },
  { label: "Regular Languages", Icon: Braces, at: 0.53, xPct: 72, yPct: 24, tone: "text-indigo-400", chip: "border-indigo-500/40 bg-indigo-950/60" },
  { label: "Pushdown Automata", Icon: Layers, at: 0.64, xPct: 22, yPct: 46, tone: "text-blue-400", chip: "border-blue-500/40 bg-blue-950/60" },
  { label: "Turing Machines", Icon: InfinityIcon, at: 0.75, xPct: 70, yPct: 64, tone: "text-purple-400", chip: "border-purple-500/40 bg-purple-950/60" },
  { label: "Episode Boss", Icon: Skull, at: 0.86, xPct: 40, yPct: 86, tone: "text-red-400", chip: "border-red-500/40 bg-red-950/60", boss: true },
];

export function ScrollQuestForge() {
  const reduceMotion = useReducedMotionPref();
  const { wrapRef, stageRef } = useStageScrub(writePct);

  if (reduceMotion) return <ForgeStatic />;

  return (
    <>
      {/* Mobile: static fallback (sticky scrub is cramped under 768px) */}
      <div className="md:hidden">
        <ForgeStatic />
      </div>

      <div ref={wrapRef} className="hidden md:block relative h-[300vh]">
        <div
          ref={stageRef}
          style={{ ["--p" as string]: 0 }}
          className="sticky top-0 h-screen overflow-hidden"
        >
          {/* Giant chapter numeral — set dressing, slow parallax drift */}
          <span
            aria-hidden
            style={{ transform: `translateY(calc(90px - var(--p) * 200px))` }}
            className="chapter-numeral font-pixel absolute -left-12 bottom-[-4rem] pointer-events-none"
          >
            01
          </span>

          <div className="h-full max-w-6xl mx-auto px-10 grid grid-cols-[0.85fr_1.15fr] items-center gap-14">
            {/* ── Copy column ── */}
            <div>
              <Fade appear={[0.02, 0.1]}>
                <span className="rank-chip mb-7 inline-flex">
                  <span aria-hidden className="opacity-50">&#9670;</span>
                  <span>CHAPTER 01 &middot; THE FORGE</span>
                  <span aria-hidden className="opacity-50">&#9670;</span>
                </span>
                <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.08] mb-6">
                  One PDF becomes
                  <br />
                  <span className="text-indigo-400">a whole world.</span>
                </h2>
              </Fade>

              {/* Sub-copy crossfades with the scene's two phases */}
              <div className="relative h-24">
                <Fade appear={[0.04, 0.12]} vanish={[0.24, 0.32]} className="absolute inset-0">
                  <p className="text-lg text-slate-400 leading-relaxed max-w-sm">
                    Drop in lecture slides, a textbook, last year&apos;s notes.
                    Anything.
                  </p>
                </Fade>
                <Fade appear={[0.38, 0.48]} className="absolute inset-0">
                  <p className="text-lg text-slate-400 leading-relaxed max-w-sm">
                    Claude forges it into episodes, topics, and a boss guarding
                    the gate. Keep scrolling — you&apos;re drawing the map.
                  </p>
                </Fade>
              </div>
            </div>

            {/* ── Scene column ── */}
            <div className="relative h-[72vh]">
              {/* PDF card — disintegrates into shards. --d is the local
                  disintegration timeline (0→1 over p 0.16→0.36). */}
              <div
                style={{
                  ["--d" as string]: r(0.16, 0.36),
                  transform: `translate(-50%, -50%) scale(calc(0.92 + ${r(0, 0.1)} * 0.08))`,
                }}
                className="absolute left-1/2 top-1/2 w-60 h-72"
              >
                {/* PDF face — fades in the first third of the disintegration */}
                <div
                  style={{ opacity: "calc(1 - clamp(0, var(--d) * 2.4, 1))" }}
                  className="absolute inset-0 pixel-border bg-slate-900/95 text-indigo-500/80 p-6 flex flex-col items-center justify-center gap-4"
                >
                  <FileText className="w-12 h-12 text-indigo-400" />
                  <div className="text-center">
                    <p className="font-pixel text-[9px] tracking-wider text-white mb-1.5">
                      AUTOMATA.PDF
                    </p>
                    <p className="font-pixel text-[8px] tracking-wider text-slate-500">
                      214 PAGES &middot; 5 MB
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="font-pixel text-[8px] tracking-wider">
                      ANALYZING&hellip;
                    </span>
                  </div>
                </div>

                {/* Shard field — invisible at rest, flies + fades as --d → 1 */}
                <div aria-hidden className="absolute inset-0 pointer-events-none">
                  {SHARDS.map((s, i) => (
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

              {/* Course map — path draws itself, nodes ignite */}
              <div
                style={{
                  opacity: `calc(${r(0.32, 0.42)})`,
                  transform: `translateY(calc((1 - ${r(0.32, 0.5)}) * 50px))`,
                }}
                className="absolute inset-0"
              >
                <svg
                  aria-hidden
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {/* pathLength=1 normalizes the draw: dashoffset 1→0 = 0→100% drawn */}
                  <path
                    d="M 16 8 C 50 4, 78 10, 72 24 C 66 38, 30 34, 22 46 C 14 58, 60 52, 70 64 C 78 74, 56 84, 40 86"
                    fill="none"
                    stroke="rgb(99 102 241 / 0.55)"
                    strokeWidth="0.7"
                    pathLength={1}
                    strokeDasharray="1"
                    style={{ strokeDashoffset: `calc(1 - ${r(0.36, 0.84)})` }}
                  />
                </svg>
                {MAP_NODES.map((node) => (
                  <div
                    key={node.label}
                    style={{
                      left: `${node.xPct}%`,
                      top: `${node.yPct}%`,
                      opacity: `calc(${r(node.at - 0.01, node.at + 0.03)})`,
                      transform: `translate(-50%, -50%) scale(calc(0.3 + ${r(node.at, node.at + 0.05)} * 0.7))`,
                    }}
                    className="absolute flex items-center gap-2.5"
                  >
                    <div
                      className={cn(
                        "relative w-11 h-11 pixel-border bg-slate-900/95 flex items-center justify-center flex-shrink-0",
                        node.boss ? "text-red-500/70" : "text-indigo-500/70",
                      )}
                    >
                      {/* Amber ignition flash right as the node lands */}
                      <div
                        aria-hidden
                        style={{ opacity: `calc(${win(node.at, node.at + 0.025, node.at + 0.025, node.at + 0.07)})` }}
                        className="absolute -inset-2 bg-amber-400/40 blur-md"
                      />
                      <node.Icon className={cn("relative w-5 h-5", node.tone)} />
                    </div>
                    <span
                      className={cn(
                        "font-pixel text-[8px] tracking-wider px-2 py-1.5 border whitespace-nowrap",
                        node.chip,
                        node.tone,
                      )}
                    >
                      {node.label.toUpperCase()}
                    </span>
                  </div>
                ))}

                {/* WORLD READY stamp */}
                <div
                  style={{
                    opacity: `calc(${r(0.9, 0.94)})`,
                    transform: `rotate(6deg) scale(calc(2.2 - ${r(0.9, 0.96)} * 1.2))`,
                  }}
                  className="absolute right-0 top-0"
                >
                  <span className="font-pixel text-[11px] tracking-wider px-4 py-3 pixel-border bg-amber-500/15 text-amber-300 inline-flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    WORLD READY
                  </span>
                </div>
              </div>
            </div>
          </div>

          <StageHud label="&#9632; FORGING WORLD" />
        </div>
      </div>
    </>
  );
}

/** Static chapter 01 — mobile + reduced-motion. Final state, no scrub. */
function ForgeStatic() {
  return (
    <section className="container mx-auto px-6 py-20 max-w-6xl">
      <span className="rank-chip mb-6 inline-flex">
        <span aria-hidden className="opacity-50">&#9670;</span>
        <span>CHAPTER 01 &middot; THE FORGE</span>
        <span aria-hidden className="opacity-50">&#9670;</span>
      </span>
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
        One PDF becomes <span className="text-indigo-400">a whole world.</span>
      </h2>
      <p className="text-slate-400 leading-relaxed max-w-md mb-10">
        Drop in lecture slides or a textbook. Claude forges it into episodes,
        topics, and a boss guarding the gate.
      </p>
      <div className="space-y-2.5 max-w-sm">
        {MAP_NODES.map(({ label, Icon, tone, chip }) => (
          <div
            key={label}
            className={cn("flex items-center gap-3 px-3 py-2.5 border", chip)}
          >
            <Icon className={cn("w-4 h-4 flex-shrink-0", tone)} />
            <span className={cn("font-pixel text-[9px] tracking-wider", tone)}>
              {label.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════ CHAPTER 03 — BOSS ═════════════════════════════════

// Hit timeline: each answer card flies in and lands at `at`; boss HP steps
// down 20% per hit. All windows are non-overlapping and ascending.
const HITS = [
  { at: 0.24, q: "Pump the lemma on L = aⁿbⁿ", x0: -210, tilt: -9 },
  { at: 0.38, q: "Build the DFA for (ab)*", x0: -150, tilt: -5 },
  { at: 0.52, q: "Is L context-free? Prove it", x0: -240, tilt: -12 },
  { at: 0.66, q: "Reduce HALT to this language", x0: -170, tilt: -7 },
  { at: 0.8, q: "Decidable or not — final answer", x0: -200, tilt: -10 },
];

/** JS mirror of the CSS HP staircase, for the % counter. */
function hpOf(p: number) {
  return HITS.reduce((hp, h) => hp - 20 * clamp01((p - h.at) / 0.02), 100);
}

/** Boss onFrame: HUD percent + HP counter. */
function bossFrame(p: number, stage: HTMLDivElement) {
  writePct(p, stage);
  const hp = stage.querySelector("[data-hp]");
  if (hp) hp.textContent = `${Math.round(hpOf(p))}%`;
}

// Victory confetti — deterministic radial burst. Offsets are rounded because
// Math.cos/sin can differ in the last ULP between Node (SSR) and the browser,
// which trips React's hydration diff on the inline transform string.
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const dist = 120 + ((i * 53) % 90);
  return {
    dx: Math.round(Math.cos(angle) * dist),
    dy: Math.round(Math.sin(angle) * dist * 0.7 - 60),
    rot: ((i * 97) % 360) - 180,
    size: 5 + ((i * 13) % 6),
    tone: i % 3 === 0 ? "bg-amber-400" : i % 3 === 1 ? "bg-indigo-400" : "bg-amber-200",
  };
});

export function ScrollQuestBoss() {
  const reduceMotion = useReducedMotionPref();
  const { wrapRef, stageRef } = useStageScrub(bossFrame);

  // Boss flinch: a leftward kick window at every hit point.
  const shakeX = HITS.map(
    ({ at }) => `${win(at - 0.005, at + 0.008, at + 0.012, at + 0.032)} * -14px`,
  ).join(" + ");

  // HP staircase: holds between hits, drops 20% right at each one.
  const hpWidth = `calc((1 - (${HITS.map(({ at }) => `0.2 * ${r(at, at + 0.02)}`).join(" + ")})) * 100%)`;

  // Red flash spikes on every impact.
  const hitFlash = HITS.map(
    ({ at }) => win(at - 0.004, at + 0.008, at + 0.008, at + 0.03),
  ).join(" + ");

  if (reduceMotion) return <BossStatic />;

  return (
    <>
      <div className="md:hidden">
        <BossStatic />
      </div>

      <div ref={wrapRef} className="hidden md:block relative h-[340vh]">
        <div
          ref={stageRef}
          style={{ ["--p" as string]: 0 }}
          className="sticky top-0 h-screen overflow-hidden"
        >
          {/* Arena light — red drains as the fight progresses, gold floods in
              at victory */}
          <div
            aria-hidden
            style={{ opacity: `calc(${r(0.05, 0.14)} * 0.45 * (1 - ${r(0.2, 0.8)}))` }}
            className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_62%_45%,rgb(239_68_68/0.3),transparent_70%)]"
          />
          <div
            aria-hidden
            style={{ opacity: `calc(${r(0.83, 0.92)} * 0.45)` }}
            className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_62%_45%,rgb(245_158_11/0.3),transparent_70%)]"
          />

          <span
            aria-hidden
            style={{ transform: `translateY(calc(90px - var(--p) * 200px))` }}
            className="chapter-numeral chapter-numeral-red font-pixel absolute -left-6 top-[26%] pointer-events-none"
          >
            03
          </span>

          <div className="relative h-full max-w-6xl mx-auto px-10 flex flex-col justify-center">
            {/* ── Kicker + headline ── */}
            <div className="absolute top-[9vh] left-10 right-10">
              <Fade appear={[0.03, 0.1]}>
                <span className="rank-chip mb-5 inline-flex">
                  <span aria-hidden className="opacity-50">&#9670;</span>
                  <span>CHAPTER 03 &middot; THE FINAL TRIAL</span>
                  <span aria-hidden className="opacity-50">&#9670;</span>
                </span>
              </Fade>
              <div className="relative h-28">
                <Fade appear={[0.05, 0.13]} vanish={[0.76, 0.82]} className="absolute inset-0">
                  <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.08]">
                    Every episode ends
                    <br />
                    in a <span className="text-red-400">boss fight.</span>
                  </h2>
                </Fade>
                <Fade appear={[0.86, 0.92]} className="absolute inset-0">
                  <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.08]">
                    You&apos;re ready for
                    <br />
                    the <span className="text-amber-400">real exam.</span>
                  </h2>
                </Fade>
              </div>
            </div>

            {/* ── HP bar ── */}
            <Fade
              appear={[0.08, 0.16]}
              className="absolute top-[34vh] left-1/2 -translate-x-1/2 w-full max-w-xl px-8"
            >
              <div className="flex justify-between mb-2">
                <span className="font-pixel text-[9px] tracking-wider text-slate-500 inline-flex items-center gap-1.5">
                  <Skull className="w-3.5 h-3.5 text-red-400" /> THE FINAL EXAM
                </span>
                <span data-hp className="font-pixel text-[11px] tracking-wider text-red-400 tabular-nums">
                  100%
                </span>
              </div>
              <div className="h-4 pixel-border text-red-900/60 bg-white/[0.04] overflow-hidden">
                <div
                  className="h-full bg-red-600"
                  style={{
                    width: hpWidth,
                    backgroundImage:
                      "repeating-linear-gradient(90deg, transparent 0 10px, rgba(0,0,0,0.35) 10px 12px)",
                  }}
                />
              </div>
            </Fade>

            {/* ── Boss ── */}
            <div
              style={{
                opacity: `calc(${r(0.05, 0.14)} * (1 - ${r(0.81, 0.9)} * 0.9))`,
                transform: `translate(calc(${shakeX}), calc(${r(0.81, 0.9)} * 70px)) rotate(calc(${r(0.81, 0.9)} * 12deg))`,
                filter: `grayscale(${r(0.81, 0.88)})`,
              }}
              className="absolute right-[14%] top-[38%]"
            >
              <div className="relative w-44 h-44 pixel-border bg-red-950/40 text-red-500/70 flex items-center justify-center">
                <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-red-400" />
                <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-400" />
                <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-red-400" />
                <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-red-400" />
                <Skull className="w-24 h-24 text-red-400" />
              </div>
            </div>

            {/* ── Answer cards landing hits + damage pops ── */}
            {HITS.map((hit, i) => {
              const { at, x0, tilt } = hit;
              const fly = r(at - 0.12, at);
              return (
                <div key={at}>
                  <div
                    style={{
                      opacity: `calc(${r(at - 0.12, at - 0.1)} * (1 - ${r(at - 0.005, at + 0.012)}))`,
                      transform: `translate(calc(${x0}px + ${fly} * ${46 - x0}px), calc(300px - ${fly} * 316px)) rotate(calc(${tilt}deg + ${fly} * ${4 - tilt}deg)) scale(calc(1 - ${r(at - 0.02, at + 0.012)} * 0.3))`,
                    }}
                    className="absolute left-1/4 top-1/2 w-64 pixel-border bg-slate-900/95 text-indigo-500/70 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-pixel text-[8px] tracking-wider px-1.5 py-1 pixel-border bg-indigo-500/10 text-indigo-400">
                        Q{i + 1}
                      </span>
                      <span className="font-pixel text-[8px] tracking-wider text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> CORRECT
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white leading-snug">{hit.q}</p>
                  </div>

                  <span
                    aria-hidden
                    style={{
                      opacity: `calc(${r(at, at + 0.012)} * (1 - ${r(at + 0.05, at + 0.065)}))`,
                      transform: `translateY(calc(${r(at, at + 0.065)} * -54px))`,
                    }}
                    className="absolute right-[22%] top-[30%] font-pixel text-[16px] tracking-wider text-red-400"
                  >
                    -20%
                  </span>
                </div>
              );
            })}

            {/* ── Victory ── */}
            <div className="absolute right-[8%] top-[38%] w-80 flex flex-col items-center text-center pointer-events-none">
              {/* Confetti — --v is the local burst timeline with a gravity arc */}
              <div
                aria-hidden
                style={{ ["--v" as string]: r(0.84, 1) }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {CONFETTI.map((c, i) => (
                  <span
                    key={i}
                    className={cn("absolute", c.tone)}
                    style={{
                      width: c.size,
                      height: c.size,
                      transform: `translate(calc(var(--v) * ${c.dx}px), calc(var(--v) * ${c.dy}px + var(--v) * var(--v) * 160px)) rotate(calc(var(--v) * ${c.rot}deg))`,
                      opacity: `calc(1.1 - var(--v) * 1.3)`,
                    }}
                  />
                ))}
              </div>

              <div
                style={{
                  opacity: `calc(${r(0.84, 0.87)})`,
                  transform: `scale(calc(2.4 - ${r(0.84, 0.895)} * 1.4)) rotate(calc(-6deg + ${r(0.84, 0.895)} * 6deg))`,
                }}
                className="font-pixel text-3xl xl:text-4xl tracking-wider text-amber-400 text-glow-amber"
              >
                VICTORY
              </div>
              <div
                style={{
                  opacity: `calc(${r(0.9, 0.94)})`,
                  transform: `translateY(calc((1 - ${r(0.9, 0.94)}) * 22px))`,
                }}
                className="mt-6 font-pixel text-[10px] tracking-wider px-4 py-3 pixel-border bg-amber-500/15 text-amber-300 inline-flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                +500 XP &middot; EPISODE MASTERED
              </div>
              <div
                style={{ opacity: `calc(${r(0.95, 1)})` }}
                className="mt-8 flex flex-col items-center gap-1 text-slate-500"
              >
                <span className="font-pixel text-[8px] tracking-[0.2em]">CLAIM YOUR REWARD</span>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Hit flash + victory white-out — top of the stack */}
          <div
            aria-hidden
            style={{ opacity: `calc((${hitFlash}) * 0.35)` }}
            className="absolute inset-0 bg-red-500/30 pointer-events-none"
          />
          <div
            aria-hidden
            style={{ opacity: `calc(${win(0.81, 0.835, 0.835, 0.875)} * 0.7)` }}
            className="absolute inset-0 bg-amber-50 pointer-events-none"
          />

          <StageHud label="&#9632; BOSS FIGHT" tone="red" />
        </div>
      </div>
    </>
  );
}

/** Static chapter 03 — mobile + reduced-motion. Victory state, no scrub. */
function BossStatic() {
  return (
    <section className="container mx-auto px-6 py-20 max-w-6xl">
      <span className="rank-chip mb-6 inline-flex">
        <span aria-hidden className="opacity-50">&#9670;</span>
        <span>CHAPTER 03 &middot; THE FINAL TRIAL</span>
        <span aria-hidden className="opacity-50">&#9670;</span>
      </span>
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
        Every episode ends in a <span className="text-red-400">boss fight.</span>
      </h2>
      <p className="text-slate-400 leading-relaxed max-w-md mb-8">
        Thirteen comprehensive questions guard the gate. Defeat them and the
        episode is yours — XP in the bank, mastery on the map.
      </p>
      <div className="flex items-center gap-4 max-w-sm">
        <div className="w-16 h-16 pixel-border bg-red-950/40 text-red-500/70 flex items-center justify-center flex-shrink-0">
          <Swords className="w-8 h-8 text-red-400" />
        </div>
        <div className="font-pixel text-[9px] tracking-wider px-3 py-2.5 pixel-border bg-amber-500/15 text-amber-300 inline-flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          +500 XP &middot; EPISODE MASTERED
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { BookOpen, Sparkles, Swords, Plus, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Empty-state dashboard hero.
 *
 * Renders when `courses.length === 0` — either a brand-new user (already
 * past the Welcome Modal) or a returning user who deleted all their
 * courses. Replaces the entire normal dashboard widget stack (hero card,
 * exam plans, today's mission, grimoire, quest board, your realm) — none
 * of those have meaningful data at zero courses, so showing them would
 * just look broken.
 *
 * Three sections:
 *   1. Headline + sub — frames the "begin your journey" moment
 *   2. 3-up step grid — Upload → AI Extracts → Quest, mirrors the
 *      WelcomeModal's "How it works" slide so the two read as the same
 *      universe
 *   3. Primary CTA + tip — big amber upload button + a one-line
 *      reassurance about what counts as upload-worthy material
 *
 * Pure server component — no client state. Layout: pixel-bordered card,
 * indigo accent (active/quest color across the app).
 */
export default function EmptyDashboardHero() {
  return (
    <section
      aria-labelledby="empty-dashboard-heading"
      className="relative bg-slate-900/95 pixel-border text-indigo-500/70 px-6 py-10 sm:px-12 sm:py-14"
    >
      {/* Pixel nail corners — indigo, matches the "begin quest" energy */}
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400" />

      <div className="relative max-w-2xl mx-auto text-center space-y-8 sm:space-y-10">
        {/* Headline */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 font-pixel text-[10px] tracking-wider text-indigo-300/90">
            <Swords className="w-3 h-3" aria-hidden />
            BEGIN YOUR JOURNEY
          </div>
          <h1
            id="empty-dashboard-heading"
            className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
          >
            Your first quest awaits.
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto leading-relaxed">
            Upload any study PDF and StudyQuest transforms it into topics,
            trials, and bosses. Three steps from textbook to mastery.
          </p>
        </div>

        {/* 3-up step grid — mirrors the WelcomeModal's "how it works" slide
            so a user who just dismissed the modal sees the same pipeline
            represented as ambient guidance. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Step
            icon={<BookOpen className="w-5 h-5" />}
            label="UPLOAD"
            body="A PDF — textbook chapter, lecture slides, or study guide."
            tone="indigo"
            ordinal="01"
          />
          <Step
            icon={<Sparkles className="w-5 h-5" />}
            label="AI EXTRACTS"
            body="Topics, questions, and daily insights, drafted by Claude."
            tone="purple"
            ordinal="02"
          />
          <Step
            icon={<Swords className="w-5 h-5" />}
            label="QUEST ON"
            body="Earn XP, master topics, and slay episode bosses."
            tone="amber"
            ordinal="03"
          />
        </div>

        {/* Primary CTA — chunky pixel-shadow button, amber to read as
            the next-action celebration. Matches the WelcomeModal's final
            "ENTER THE REALM" colour so the two flows feel continuous. */}
        <div className="flex flex-col items-center gap-3">
          <Link href="/dashboard/courses/new">
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-2 px-6 py-3.5 font-pixel text-[11px] tracking-wider",
                "bg-amber-500 text-slate-950 shadow-[0_4px_0_0_#78350f]",
                "hover:shadow-[0_2px_0_0_#78350f] hover:translate-y-0.5",
                "active:shadow-[0_0_0_0_#78350f] active:translate-y-1",
                "transition-transform duration-100 pixel-focus outline-none"
              )}
            >
              <Plus className="w-4 h-4" aria-hidden />
              UPLOAD YOUR FIRST COURSE
            </button>
          </Link>

          {/* One-line reassurance — answers the implicit "what should I
              upload?" question without forcing a click. */}
          <p className="inline-flex items-center gap-1.5 text-xs text-slate-600 max-w-md mx-auto">
            <Lightbulb className="w-3 h-3" aria-hidden />
            Textbook chapters, lecture slides, study guides. 100 pages or fewer per upload works best.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Step tile ───────────────────────────────────────────────────────────────

type StepTone = "indigo" | "purple" | "amber";

const STEP_PALETTE: Record<StepTone, { fg: string; bg: string; border: string }> = {
  indigo: { fg: "text-indigo-400", bg: "bg-indigo-500/10", border: "text-indigo-500/40" },
  purple: { fg: "text-purple-400", bg: "bg-purple-500/10", border: "text-purple-500/40" },
  amber:  { fg: "text-amber-400",  bg: "bg-amber-500/10",  border: "text-amber-500/40" },
};

function Step({
  icon,
  label,
  body,
  tone,
  ordinal,
}: {
  icon: React.ReactNode;
  label: string;
  body: string;
  tone: StepTone;
  ordinal: string;
}) {
  const c = STEP_PALETTE[tone];
  return (
    <div
      className={cn(
        "relative bg-slate-900/60 pixel-border px-4 py-4 text-left flex flex-col gap-2.5",
        c.border
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            "w-9 h-9 pixel-border flex items-center justify-center",
            c.fg,
            c.bg
          )}
        >
          {icon}
        </div>
        <span className={cn("font-pixel text-[10px] tabular-nums", c.fg, "opacity-60")}>
          {ordinal}
        </span>
      </div>
      <div>
        <div className={cn("font-pixel text-[9px] tracking-wider", c.fg)}>{label}</div>
        <p className="text-xs text-slate-400 leading-relaxed mt-1">{body}</p>
      </div>
    </div>
  );
}

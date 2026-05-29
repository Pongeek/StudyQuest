"use client";

import { cn } from "@/lib/utils";

export type Confidence = "guessed" | "unsure" | "confident";

interface ConfidenceRowProps {
  value: Confidence | null;
  onChange: (next: Confidence) => void;
  dir?: "ltr" | "rtl" | "auto";
  disabled?: boolean;
}

const BUTTONS: Array<{ value: Confidence; label: string; tone: string; hover: string }> = [
  {
    value: "guessed",
    label: "GUESSED",
    tone: "text-red-400 border-red-500/30",
    hover: "hover:border-red-500/60 hover:bg-red-500/10",
  },
  {
    value: "unsure",
    label: "UNSURE",
    tone: "text-amber-400 border-amber-500/30",
    hover: "hover:border-amber-500/60 hover:bg-amber-500/10",
  },
  {
    value: "confident",
    label: "CONFIDENT",
    tone: "text-emerald-400 border-emerald-500/30",
    hover: "hover:border-emerald-500/60 hover:bg-emerald-500/10",
  },
];

/**
 * 3-button confidence row, rendered after Submit in the post-grade
 * feedback block of QuizEngine (Phase 1 pilot — Review/Boss/Exam in Phase 2).
 *
 * - All three buttons skippable. Tapping Next without choosing is fine;
 *   confidence stays NULL on the answer row.
 * - Selecting a value visually locks the chosen button (filled style) and
 *   dims the others. State is owned by the parent so the parent can also
 *   fire the PATCH /api/quiz/answers/[id]/confidence call.
 * - RTL: row reverses so Confident sits on the right when reading R-to-L.
 */
export default function ConfidenceRow({
  value,
  onChange,
  dir = "auto",
  disabled = false,
}: ConfidenceRowProps) {
  return (
    <div className="mt-3" dir={dir}>
      <p className="font-pixel text-[8px] tracking-wider text-slate-500 mb-2">
        HOW CONFIDENT WERE YOU?
      </p>
      <div className={cn("flex gap-2", dir === "rtl" && "flex-row-reverse")}>
        {BUTTONS.map((b) => {
          const selected = value === b.value;
          return (
            <button
              key={b.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(b.value)}
              className={cn(
                "pixel-chip px-3 py-1.5 font-pixel text-[9px] tracking-wider border transition-colors",
                b.tone,
                !disabled && !selected && b.hover,
                selected && "bg-white/[0.04] ring-1 ring-inset ring-white/10",
                !selected && "opacity-70",
                disabled && "cursor-not-allowed opacity-40",
              )}
              aria-pressed={selected}
              aria-label={`Mark this answer as ${b.label.toLowerCase()}`}
            >
              {b.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

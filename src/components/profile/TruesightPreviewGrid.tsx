// ─── TruesightPreviewGrid (dev-only) ─────────────────────────────────────────
// Renders the Truesight section across every state — cold-start, well-
// calibrated, overconfident (with the blind-spot drill-down populated),
// underconfident, mixed, and the zero-stumble good-news case — so the visuals
// can be inspected without grinding 20 real rated answers into the right shape.
//
// Mounted on the Profile page when the URL has `?truesightPreview=1`. Each
// scenario is fed through the *real* computeCalibration helper, so the preview
// renders genuine view models, not hand-faked ones. The topic links point at
// synthetic course/topic ids — clicking them in the preview is expected to 404;
// the point is to eyeball the drill-down, not navigate.

import {
  computeCalibration,
  type CalibrationAnswer,
} from "@/lib/calibration";
import TruesightSection from "@/components/profile/TruesightSection";

/** One answer row; thematic Automata titles so the drill-down reads realistically. */
function a(
  confidence: CalibrationAnswer["confidence"],
  score: number,
  topicId = "t",
  topicTitle = "Topic",
  courseId = "c-demo"
): CalibrationAnswer {
  return { confidence, score, topicId, topicTitle, courseId };
}

/** N copies of one row. */
function many(n: number, row: CalibrationAnswer): CalibrationAnswer[] {
  return Array.from({ length: n }, () => ({ ...row }));
}

const RIGHT = 1;
const WRONG = 0;

const SCENARIOS: { label: string; note: string; answers: CalibrationAnswer[] }[] =
  [
    {
      label: "Cold-start",
      note: "< 20 rated → focusing nudge, no chips/verdict",
      answers: [...many(4, a("confident", RIGHT)), ...many(4, a("guessed", WRONG))],
    },
    {
      label: "Well-calibrated · zero stumbles",
      note: "confident always right, guesses wrong → good-news chip, no drill-down",
      answers: [
        ...many(12, a("confident", RIGHT)),
        ...many(8, a("guessed", WRONG)),
      ],
    },
    {
      label: "Overconfident · drill-down populated",
      note: "6 blind-spot topics → top 5 + “+1 more”, each a link",
      answers: [
        ...many(5, a("confident", WRONG, "t-pump", "Pumping Lemma")),
        ...many(4, a("confident", WRONG, "t-tm", "Turing Machines")),
        ...many(3, a("confident", WRONG, "t-dfa", "DFA Minimization")),
        ...many(2, a("confident", WRONG, "t-cfg", "Context-Free Grammars")),
        ...many(2, a("confident", WRONG, "t-regex", "Regular Expressions")),
        ...many(1, a("confident", WRONG, "t-closure", "Closure Properties")),
        ...many(8, a("confident", RIGHT, "t-pump", "Pumping Lemma")),
        ...many(8, a("guessed", WRONG, "t-misc", "Misc")),
      ],
    },
    {
      label: "Underconfident",
      note: "confident solid, guesses keep landing right → trust-your-gut verdict",
      answers: [
        ...many(10, a("confident", RIGHT)),
        ...many(7, a("guessed", RIGHT)),
        ...many(3, a("guessed", WRONG)),
      ],
    },
    {
      label: "Mixed · drill-down populated",
      note: "both overconfident misses and lucky guesses cross threshold",
      answers: [
        ...many(2, a("confident", WRONG, "t-pump", "Pumping Lemma")),
        ...many(2, a("confident", WRONG, "t-tm", "Turing Machines")),
        ...many(6, a("confident", RIGHT, "t-pump", "Pumping Lemma")),
        ...many(6, a("guessed", RIGHT)),
        ...many(4, a("guessed", WRONG)),
      ],
    },
  ];

export default function TruesightPreviewGrid() {
  return (
    <section
      aria-labelledby="truesight-preview-heading"
      className="rpg-card rounded-2xl p-5 sm:p-6"
    >
      <header className="mb-5">
        <h2
          id="truesight-preview-heading"
          className="font-pixel text-[12px] tracking-widest text-amber-300 mb-1"
        >
          DEV · TRUESIGHT PREVIEW
        </h2>
        <p className="text-xs text-slate-500">
          Every Truesight state side-by-side, each rendered through the real
          computeCalibration helper. Strip this from the page before shipping —
          it&apos;s gated on <code className="text-slate-400">?truesightPreview=1</code>.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {SCENARIOS.map((s) => (
          <div key={s.label} className="space-y-2">
            <div className="px-1">
              <div className="font-pixel text-[9px] tracking-wider text-purple-300/90">
                {s.label}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{s.note}</div>
            </div>
            <TruesightSection view={computeCalibration(s.answers)} />
          </div>
        ))}
      </div>
    </section>
  );
}

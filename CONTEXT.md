# StudyQuest — Context Glossary

A shared vocabulary for StudyQuest. Definitions only — no implementation
details. When a term here conflicts with how the code or a conversation uses a
word, the conflict gets resolved and this file updated.

## Sessions

- **Quiz session** — a study session scoped to a **single topic**. Spaced-repetition
  scheduling produces one update for that topic at completion.
- **Review session** — a spaced-repetition session that **interleaves multiple
  topics** (several topics, a small number of questions each). Scheduling is
  computed **independently per topic** at completion, not once for the session.
- **Boss fight** — an end-of-episode comprehensive trial covering a whole episode.
- **Exam (prep) session** — practice against questions extracted from a real past
  exam; feedback is deferred to the end to mimic real exam conditions.

## Spaced repetition

- **Quality** — the SM-2 grade (0–5) derived from how an answer scored. Drives
  the next-review interval.
- **Confidence** — the learner's **self-reported** certainty about an answer,
  captured *after* grading: `guessed`, `unsure`, or `confident`. Distinct from
  Quality (which is measured, not self-reported).
- **Confidence-weighted scheduling** — folding Confidence into Quality so that
  self-knowledge changes the review interval (e.g. confident-but-wrong reviews
  sooner; confident-and-right pushes deeper).
- **Lucky guess** — a correct answer the learner marked `guessed`. Treated as a
  weaker mastery signal than a confident-correct answer.
- **Overconfident stumble** — a wrong answer the learner marked `confident`. The
  strongest "review this again soon" signal.

## Identity & titles

- **Rank** — the **level-derived** title (Novice → Apprentice → Adept → Expert →
  Master → Sage). Reflects *how strong* the learner is (accumulated XP). Shown in
  the hero card's rank-chip above the name. Rank only ever rises.
- **Streak Title** — a **streak-derived** honorific earned by studying on
  consecutive days. Reflects *how disciplined* the learner is **right now**,
  independent of Rank. Tiers: Disciplined (7d), Relentless (14d), Unbroken (30d),
  Ascendant (60d), Eternal (100d). Unlike Rank, a Streak Title tracks the *current*
  streak: it lapses if the streak resets and is re-earned on the next qualifying
  run. Below 7 days the learner holds no Streak Title. A learner can hold a Rank
  and a Streak Title at once; they are orthogonal identities and never merge.

## Coaching voice

- **Loremaster** — the single in-character coaching voice the AI uses for grading
  feedback, debriefs, and the answer clarifier.
- **Clarifier** — a short, in-character follow-up conversation that explains why an
  answer was wrong (or why a lucky guess was still right).

## Achievements

- **Achievement** — a data-driven badge (a row in the `achievements` table) a
  learner earns by meeting a Condition. Carries an XP reward folded into the
  learner's total when granted.
- **Condition** — an Achievement's earn rule: a `condition_type` (e.g.
  `streak_days`, `perfect_quiz`, `boss_fights_completed`) tested against a
  `condition_value`. The catalogue of condition types is fixed in code.
- **Award model** — how an Achievement is granted. Two coexist: *slug-based*
  (imperative — "grant this specific badge now"; used by the Scroll and Feynman
  flows, which already know the badge) and *condition-based* (evaluate every
  applicable Condition after a session and grant whatever newly qualifies; used
  by the session-completion routes). They are distinct interfaces, not two
  adapters of one.
- **Surface scope** — which session types a Condition is evaluated on under the
  condition-based model. Most are *any-surface* — a streak milestone or a
  mastery count is earned however the learner studied. A few are *scoped* to the
  session type they semantically mean: `perfect_quiz`, `fast_quiz` and the
  `random` lucky-badge are quiz-only; `course_completed` is quiz-or-boss.

## Surfaces

- **Content** — text the AI generates *for* the learner (questions, feedback,
  debriefs, cheat sheets, scrolls). Governed by the Loremaster persona, can be
  Hebrew or English per the course's output language, and is RTL-rendered when
  Hebrew.
- **Chrome** — the app's own static UI text (buttons, labels, nav, loading copy).
  Hand-written, always English, never AI-generated. The Loremaster persona does
  not govern Chrome — any in-character flavor in Chrome is a hand-authored style
  choice, kept lighter and more restrained than the AI's spoken voice.

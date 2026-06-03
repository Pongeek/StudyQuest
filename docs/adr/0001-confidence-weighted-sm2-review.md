# Confidence-weighted SM-2 in Review folds per-topic, undampened

**Status:** accepted

## Context & decision

Review sessions interleave multiple topics (a handful of topics, ~2 questions
each) and schedule spaced repetition **independently per topic**. When we
extended the confidence-weighted SM-2 scheduling (already live on the
single-topic Quiz path) to Review, we decided to apply the confidence
modulation **inside the per-topic loop**: for each topic, compute each answer's
`adjustQualityForConfidence(base, isCorrect, confidence)`, average those into
that topic's adjusted quality, then run `computeNextReviewFromQuality` once per
topic. The four-cell grid is applied **undampened** even though a topic is
typically sampled by only ~2 questions — so a single `confident + wrong` answer
(quality → 0) can nearly zero a topic's adjusted quality and reset its interval
to 1 day.

This mirrors the Quiz semantics (and reuses the exact same
`lib/spaced-repetition.ts` functions), so the same self-report means the same
thing on both surfaces. See the Quiz-path spec
`docs/superpowers/specs/2026-06-01-confidence-weighted-sm2-design.md` for the
grid itself; this ADR records only the Review-specific extension.

## Why undampened (rejected alternative)

We considered **dampening the confidence weight when `n` is small** (e.g.
softening the `confident + wrong → 0` cell on a 2-question topic so one
overconfident miss doesn't dominate). We rejected it: catching
overconfidence-then-wrong and pulling that topic back to tomorrow is *precisely*
the behavior spaced-repetition review exists for. Diluting the strongest signal
to protect the interval would defeat the purpose. We accept that the signal is
more concentrated on Review (few questions per topic) than on Quiz (longer
single-topic sessions) — that concentration is a feature, not a bug.

## Consequences

- Hard to reverse once learners build intuition around it: changing the curve
  later reshuffles everyone's review schedule.
- A future reader seeing one wrong confident answer slam a topic to a 1-day
  interval should treat that as intended, not a bug.

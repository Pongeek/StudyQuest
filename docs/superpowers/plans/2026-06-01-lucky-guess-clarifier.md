# Lucky-Guess Clarifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-shot Loremaster explanation that surfaces when a student rates a right answer as "I guessed" — closing the loop on the SessionDebrief lucky-win chip with an inline `✨ Hear the Loremaster's take →` button that, when tapped, expands one paragraph explaining why the answer is right.

**Architecture:** Server-side prompt branch on `(ai_score, confidence)` inside the existing `/api/clarify` route — no new endpoint. Persists in the polymorphic `answer_clarifications` table — no migration. New client-side `<LuckyGuessExplanation>` component (render-only) replaces nothing; mounts adjacent to (mutually exclusive with) the existing wrong-answer clarifier inside QuizEngine.

**Tech Stack:** TypeScript + Next.js 16 App Router + Supabase service client + Anthropic SDK (Claude Sonnet 4.6) + Framer Motion + Lucide icons + Tailwind v4. Pure-helper convention (no test files). Verification via `tsc --noEmit` + manual session walk-through.

**Testing approach:** Spec §8 ("No new test infrastructure") matches the existing codebase convention (`streak.ts`, `adaptive-difficulty.ts`, `clarify-answer.ts`, etc. all ship without tests). Plan substitutes **`tsc --noEmit` typecheck + Task 4's manual walk-through** for the standard TDD red/green pattern.

**Reference spec:** `docs/superpowers/specs/2026-06-01-lucky-guess-clarifier-design.md` (commit `8685530`). Read §3 before starting.

**Total scope:** 5 tasks, 4 source-file edits + 1 new file + 1 doc edit, 5 commits.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/ai/clarify-answer.ts` | Modify | Owns the clarifier prompts. Renames the existing prompt builder, adds `buildLuckyGuessPrompt`, makes `buildSystemPrompt` a branch on `(score, confidence)`. |
| `src/app/api/clarify/route.ts` | Modify | Adds single-shot enforcement on CONTINUE for lucky-guess answers. No new branches; just guards against follow-up turns on the wrong type of answer. |
| `src/components/quiz/LuckyGuessExplanation.tsx` | **Create** | Render-only client component: collapsed button → loading → expanded amber pixel panel with the Loremaster paragraph. Self-contained state. |
| `src/components/quiz/QuizEngine.tsx` | Modify | Imports `LuckyGuessExplanation` and adds one render branch alongside the existing wrong-answer clarifier. ~15 lines. |
| `CLAUDE.md` | Modify | "What shipped" subsection + hero paragraph addendum + tier-3 queue refinement. |

No new files in `src/lib/`. No migration. No env vars. No new API routes.

---

## Task 1: Branch the clarifier prompt builder

**Files:**
- Modify: `src/lib/ai/clarify-answer.ts` (replace the existing `buildSystemPrompt` function at lines 48-83 with three functions — same exports stay; one new internal function added).

- [ ] **Step 1: Verify the branch + read the current prompt builder**

Run from C:\Projects\StudyQuest:

```bash
git checkout -b lucky-guess-clarifier
git branch --show-current
```

Expected: `lucky-guess-clarifier`. STOP and report if you're not on this branch.

- [ ] **Step 2: Replace the existing `buildSystemPrompt` function**

Find the function (it currently spans lines 48-83 in `src/lib/ai/clarify-answer.ts`):

```ts
function buildSystemPrompt(ctx: ClarifierContext): string {
  const confidenceLine =
    ctx.confidence === "confident"
      ? "The student SAID they were CONFIDENT but got it wrong. Gently surface the gap — name what most students miss here. Do not shame."
      : ctx.confidence === "guessed"
        ? "The student SAID they were GUESSING. Meet them where they are. Build from primitives. No shaming, no minimizing."
        : "The student did not rate their confidence. Use a balanced default — assume mid-confidence.";

  const task = `You are clarifying a question the student got wrong (score ${ctx.score.toFixed(2)}/1.0).

YOUR JOB
- OPEN by asking what part is unclear. Do not jump straight into explaining — target the explanation to the actual confusion.
- After the student says what's unclear, give a SCAFFOLDED answer: one idea + one check question per turn.
- Three turns max under normal use. After three assistant turns, wrap up.
- You DO give answers. You are not Feynman. You are a guide who explains.
- Match the student's language. Hebrew in → Hebrew out.
- Code blocks stay LTR; prose follows the student's direction.
- Never invent facts beyond the topic source. If asked something outside scope, redirect: "That's outside this topic — but if you have the source page, I can look at it."

CONFIDENCE-AWARE TONE
${confidenceLine}

CONTEXT
Topic: ${ctx.topicTitle}
${ctx.sourceExcerpt ? `Source excerpt:\n${ctx.sourceExcerpt}\n` : ""}
Question the student got wrong:
${ctx.question}

Canonical correct answer (do NOT just paste this — scaffold to it):
${ctx.canonicalAnswer}

Student's answer:
${ctx.studentAnswer || "(the student submitted a diagram only — the image is NOT available to you in this conversation. Ask them to describe what they drew before scaffolding the answer.)"}`;

  return withCoachPersona(task);
}
```

Replace it entirely with these three functions:

```ts
function buildWrongAnswerPrompt(ctx: ClarifierContext): string {
  const confidenceLine =
    ctx.confidence === "confident"
      ? "The student SAID they were CONFIDENT but got it wrong. Gently surface the gap — name what most students miss here. Do not shame."
      : ctx.confidence === "guessed"
        ? "The student SAID they were GUESSING. Meet them where they are. Build from primitives. No shaming, no minimizing."
        : "The student did not rate their confidence. Use a balanced default — assume mid-confidence.";

  const task = `You are clarifying a question the student got wrong (score ${ctx.score.toFixed(2)}/1.0).

YOUR JOB
- OPEN by asking what part is unclear. Do not jump straight into explaining — target the explanation to the actual confusion.
- After the student says what's unclear, give a SCAFFOLDED answer: one idea + one check question per turn.
- Three turns max under normal use. After three assistant turns, wrap up.
- You DO give answers. You are not Feynman. You are a guide who explains.
- Match the student's language. Hebrew in → Hebrew out.
- Code blocks stay LTR; prose follows the student's direction.
- Never invent facts beyond the topic source. If asked something outside scope, redirect: "That's outside this topic — but if you have the source page, I can look at it."

CONFIDENCE-AWARE TONE
${confidenceLine}

CONTEXT
Topic: ${ctx.topicTitle}
${ctx.sourceExcerpt ? `Source excerpt:\n${ctx.sourceExcerpt}\n` : ""}
Question the student got wrong:
${ctx.question}

Canonical correct answer (do NOT just paste this — scaffold to it):
${ctx.canonicalAnswer}

Student's answer:
${ctx.studentAnswer || "(the student submitted a diagram only — the image is NOT available to you in this conversation. Ask them to describe what they drew before scaffolding the answer.)"}`;

  return withCoachPersona(task);
}

function buildLuckyGuessPrompt(ctx: ClarifierContext): string {
  const task = `The student got this question RIGHT (score ${ctx.score.toFixed(2)}/1.0) but rated their confidence as GUESSED. They want to understand WHY their answer is correct so the next encounter isn't a guess.

YOUR JOB
- ONE paragraph. 3-5 sentences. No headers, no lists, no follow-up question.
- OPEN by naming the trap — what about this question makes guessing tempting? (Distractors that look right, common confusion, surface-level pattern that misleads, etc.)
- CLOSE with the actual reasoning behind the correct answer — conversational, not textbook.
- Be neutral and instructive. No "Great job!" or "Lucky you!" — the Loremaster doesn't grovel.
- Match the student's language. Hebrew in → Hebrew out.
- Code blocks stay LTR; prose follows the student's direction.
- Reference the source material implicitly, not by page number.

CONTEXT
Topic: ${ctx.topicTitle}
${ctx.sourceExcerpt ? `Source excerpt:\n${ctx.sourceExcerpt}\n` : ""}
Question:
${ctx.question}

The student's answer (which was correct):
${ctx.studentAnswer || "(the student submitted a diagram only — the image is NOT available to you in this conversation. Reference what the correct answer would be in prose.)"}

Canonical correct answer (don't paste verbatim — synthesize):
${ctx.canonicalAnswer}`;

  return withCoachPersona(task);
}

/** Polymorphic dispatch: lucky-guess (right + guessed) gets a single-paragraph
 *  explainer; everything else (the original use case) gets the multi-turn
 *  scaffolded wrong-answer chat. The branch is purely in the prompt — both
 *  openClarifier and continueClarifier reuse this builder unchanged. */
function buildSystemPrompt(ctx: ClarifierContext): string {
  const isLuckyGuess = ctx.score >= 0.7 && ctx.confidence === "guessed";
  return isLuckyGuess
    ? buildLuckyGuessPrompt(ctx)
    : buildWrongAnswerPrompt(ctx);
}
```

The new `buildSystemPrompt` keeps the same name + signature, so `openClarifier` and `continueClarifier` (which call it) need no changes.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: zero new errors. Pre-existing errors elsewhere are out of scope for this task.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/clarify-answer.ts
git commit -m "$(cat <<'EOF'
feat(clarifier): branch prompt on (score, confidence) for lucky-guess

Splits the existing buildSystemPrompt into:
  - buildWrongAnswerPrompt: the existing multi-turn scaffolded prompt
    (renamed verbatim — same body, same withCoachPersona wrap)
  - buildLuckyGuessPrompt: single-paragraph explainer for right + guessed
  - buildSystemPrompt: thin dispatcher that picks based on
    (ctx.score >= 0.7 && ctx.confidence === "guessed")

openClarifier and continueClarifier are unchanged — the branch is purely
in the prompt builder. Existing wrong-answer flow keeps identical
behavior; new lucky-guess flow lights up when the route serves an
answer where score >= 0.7 AND confidence === "guessed".

Spec: docs/superpowers/specs/2026-06-01-lucky-guess-clarifier-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Single-shot enforcement in the API route

**Files:**
- Modify: `src/app/api/clarify/route.ts` (add a guard inside the CONTINUE branch — the OPEN branch is unchanged).

- [ ] **Step 1: Verify branch + read current CONTINUE branch**

Confirm `git branch --show-current` returns `lucky-guess-clarifier`.

Open `src/app/api/clarify/route.ts`. Find the CONTINUE branch — it begins with `// ── Branch 2: CONTINUE session ──` around line 249. The first guard inside it is:

```ts
if (!existing) {
  return NextResponse.json(
    classifiedErrorBody("UNKNOWN", "No active clarifier — start one first.", false),
    { status: 404 },
  );
}

// Hard budget guard: if we've already burned the cap, soft-close.
if (existing.total_output_tokens >= SESSION_OUTPUT_TOKEN_CAP) {
  return NextResponse.json({
    clarificationId: existing.id,
    messages: existing.messages,
    closed: true,
    reason: "budget",
  });
}
```

- [ ] **Step 2: Add the lucky-guess single-shot guard**

Immediately AFTER the budget-cap guard above (and BEFORE the `const history = existing.messages as ClarifierMessage[];` line that follows), insert:

```ts
// ── Lucky-guess answers are SINGLE-SHOT — no follow-up turns ──
// Detected at the answer level: score >= 0.7 AND confidence === "guessed"
// (same condition used by buildSystemPrompt in clarify-answer.ts to pick
// the lucky-guess prompt). The lucky-guess UI never sends CONTINUE; this
// guard defends against any future client and is a no-op for the normal
// wrong-answer flow.
const isLuckyGuess =
  Number(answerRow.ai_score) >= 0.7 && answerRow.confidence === "guessed";
if (isLuckyGuess) {
  return NextResponse.json(
    classifiedErrorBody(
      "UNKNOWN",
      "This explanation is single-shot — no follow-up available.",
      false,
    ),
    { status: 409 },
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean. `answerRow.ai_score` and `answerRow.confidence` are already in the route's existing SELECT (`.select("id, user_answer, ai_score, ai_feedback, image_url, confidence, question_id, session_id, quiz_sessions!inner (user_id, topic_id)")`) so no SELECT change is needed.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/clarify/route.ts
git commit -m "$(cat <<'EOF'
feat(clarify): single-shot enforcement for lucky-guess on CONTINUE

Lucky-guess answers (score >= 0.7 AND confidence === "guessed") get a
single-paragraph Loremaster explanation via the new prompt branch — no
multi-turn chat. The client UI never sends CONTINUE for them, but this
server-side guard defends against any future client trying to follow up
on a lucky-guess explanation. Returns classified 409 in that case.

The existing wrong-answer CONTINUE flow is unchanged — the guard is a
no-op when the answer was wrong or rated something other than "guessed".

Spec: docs/superpowers/specs/2026-06-01-lucky-guess-clarifier-design.md §3.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `LuckyGuessExplanation` component

**Files:**
- Create: `src/components/quiz/LuckyGuessExplanation.tsx`

- [ ] **Step 1: Verify branch**

Confirm `git branch --show-current` returns `lucky-guess-clarifier`.

- [ ] **Step 2: Create the file**

Write `src/components/quiz/LuckyGuessExplanation.tsx` with this content:

```tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dice5, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import MarkdownContent from "./MarkdownContent";
import { readClassifiedErrorFromResponse } from "@/lib/ai-error";

interface LuckyGuessExplanationProps {
  /** The persisted quiz_answers.id — required to scope the /api/clarify call. */
  answerId: string;
  /** Parent direction — passed through so RTL Hebrew renders correctly. */
  dir?: "ltr" | "rtl";
}

type Status = "collapsed" | "loading" | "open";

/**
 * Single-shot Loremaster explanation that surfaces inline beneath
 * ConfidenceRow when the student rates a RIGHT answer as "I guessed".
 *
 * Lifecycle:
 *  - Mounts collapsed. NO auto-probe (the /api/clarify OPEN branch fires
 *    Claude when no cached row exists; auto-probing every lucky-guess
 *    would burn tokens on explanations the user never reads).
 *  - On tap: POST /api/clarify. Server returns cached message OR fires
 *    one Claude call + persists. Component expands.
 *  - Revisit (navigate away/back): component remounts collapsed; re-tap
 *    returns the cached row instantly (no Claude call).
 *
 * Pairs visually with the SessionDebrief lucky-win chip (amber + Dice5 +
 * pixel chrome).
 */
export default function LuckyGuessExplanation({
  answerId,
  dir,
}: LuckyGuessExplanationProps) {
  const [status, setStatus] = useState<Status>("collapsed");
  const [content, setContent] = useState<string | null>(null);

  const open = async () => {
    if (status === "loading" || status === "open") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerKind: "quiz", answerId }),
      });
      if (!res.ok) {
        const classified = await readClassifiedErrorFromResponse(res);
        toast.error(classified.userMessage);
        setStatus("collapsed");
        return;
      }
      const data = await res.json();
      const first = Array.isArray(data.messages) ? data.messages[0] : null;
      const text: string | undefined = first?.content;
      if (!text) {
        toast.error("The Loremaster's tome was empty — try again.");
        setStatus("collapsed");
        return;
      }
      setContent(text);
      setStatus("open");
    } catch {
      toast.error("Couldn't reach the Loremaster. Check your connection and retry.");
      setStatus("collapsed");
    }
  };

  if (status === "collapsed" || status === "loading") {
    return (
      <button
        type="button"
        onClick={open}
        disabled={status === "loading"}
        className={cn(
          "mt-3 inline-flex items-center gap-1.5 pixel-chip px-3 py-1.5 font-pixel text-[9px] tracking-wider",
          "text-amber-300 border border-amber-500/30 hover:bg-amber-500/10",
          "disabled:opacity-70 disabled:cursor-not-allowed",
        )}
      >
        {status === "loading" ? (
          <>
            <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin" />
            CONSULTING THE TOME…
          </>
        ) : (
          <>
            <Dice5 aria-hidden className="w-3.5 h-3.5" />
            HEAR THE LOREMASTER&apos;S TAKE →
          </>
        )}
      </button>
    );
  }

  // status === "open"
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        role="region"
        aria-label="Loremaster's take"
        dir={dir}
        className="mt-3 pixel-border bg-amber-500/10 px-4 py-3 relative"
      >
        {/* Pixel-nail corners — peer vocabulary: 1.5 offset + z-[2]. */}
        <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[2]" />
        <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[2]" />
        <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[2]" />
        <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[2]" />

        <div className="flex items-center gap-2 mb-2">
          <Dice5 aria-hidden className="w-4 h-4 text-amber-400" />
          <span className="font-pixel text-[9px] tracking-wider text-amber-400">
            LOREMASTER&apos;S TAKE
          </span>
        </div>

        <div className="text-sm text-slate-200 leading-relaxed">
          <MarkdownContent>{content ?? ""}</MarkdownContent>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean. All imports (`motion`, `Dice5`, `Loader2`, `toast`, `cn`, `MarkdownContent`, `readClassifiedErrorFromResponse`) resolve from existing modules in this codebase.

- [ ] **Step 4: Commit**

```bash
git add src/components/quiz/LuckyGuessExplanation.tsx
git commit -m "$(cat <<'EOF'
feat(quiz): LuckyGuessExplanation component (single-shot, tap-to-reveal)

New render-only client component for the lucky-guess clarifier UI:
  - Mounts collapsed with a 'HEAR THE LOREMASTER\\'S TAKE →' pixel chip
  - On tap: POST /api/clarify { answerKind: "quiz", answerId }
  - Server returns cached or fires one Claude call (the prompt branch
    from Task 1 picks buildLuckyGuessPrompt for score >= 0.7 + guessed)
  - Expanded state: amber pixel panel with corner nails, Dice5 + 'LOREMASTER\\'S TAKE'
    pixel label, content rendered via MarkdownContent (LaTeX-aware, RTL inherits)

Self-contained state — no per-question wiring required in QuizEngine.
Question navigation remounts the component collapsed; re-tap returns the
cached message instantly. Accepted trade-off per spec §3.4.

Visual vocabulary matches the SessionDebrief lucky-win chip (amber +
Dice5 + pixel-border + 1.5-offset nails + z-[2]).

Spec: docs/superpowers/specs/2026-06-01-lucky-guess-clarifier-design.md §3.4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire `LuckyGuessExplanation` into QuizEngine

**Files:**
- Modify: `src/components/quiz/QuizEngine.tsx` (one new import + one new render branch).

- [ ] **Step 1: Add the import**

Find the existing import (around line 41):

```ts
import ClarifierThread from "@/components/quiz/ClarifierThread";
```

Add this line immediately after it:

```ts
import LuckyGuessExplanation from "@/components/quiz/LuckyGuessExplanation";
```

- [ ] **Step 2: Find the existing wrong-answer clarifier render block**

In `QuizEngine.tsx`, find the block that renders the wrong-answer clarifier (around lines 1161-1183). It looks like this:

```tsx
{curState.result.score < 0.7 && !curState.clarifierOpen && (
  <button
    type="button"
    onClick={() =>
      updateQState(currentQuestion.id, { clarifierOpen: true })
    }
    className="mt-3 inline-flex items-center gap-1.5 pixel-chip px-3 py-1.5 font-pixel text-[9px] tracking-wider text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/10"
  >
    <HelpCircle className="w-3.5 h-3.5" />
    HELP ME UNDERSTAND
  </button>
)}

{curState.result.score < 0.7 && curState.clarifierOpen && (
  <ClarifierThread
    answerKind="quiz"
    answerId={curState.answerId}
    dir={rtl ? "rtl" : "ltr"}
    onClose={() =>
      updateQState(currentQuestion.id, { clarifierOpen: false })
    }
  />
)}
```

- [ ] **Step 3: Add the lucky-guess render branch**

Immediately AFTER the `<ClarifierThread />` closing `)}` of that second block, add:

```tsx
{curState.result.score >= 0.7 &&
  curState.confidence === "guessed" &&
  curState.answerId && (
  <LuckyGuessExplanation
    answerId={curState.answerId}
    dir={rtl ? "rtl" : "ltr"}
  />
)}
```

The predicate `score >= 0.7 && confidence === "guessed" && answerId` is mutually exclusive with the wrong-answer clarifier's `score < 0.7` predicate, so the two never coexist.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 5: Manual verification — exercise the lucky-guess flow**

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000` and sign in. Then:

1. Pick any course → any topic → start a quiz.
2. Answer at least one question CORRECTLY (aim for `ai_score >= 0.7`).
3. After grading, the ConfidenceRow appears below the feedback block. Tap **"I guessed"**.
4. Confirm a `HEAR THE LOREMASTER'S TAKE →` button appears in amber pixel chip styling, beneath the confidence row.
5. Tap the button. Confirm:
   - Button switches to `CONSULTING THE TOME…` with a spinning Loader2 icon.
   - After ~1–4 seconds, an amber pixel-bordered panel expands beneath. The header reads `LOREMASTER'S TAKE` in pixel font with a Dice5 icon.
   - The body contains a single paragraph (3–5 sentences). It should name a "trap" or common confusion AND give the correct reasoning.
6. Navigate to the next question (right arrow). Navigate back. Confirm:
   - The button is back in its collapsed state (not auto-restored — this is expected per spec §3.4).
   - Re-tap the button — the panel expands without a visible spinner (instant cached return).
7. **Negative test**: in another question, get the answer right but tap **"Confident"** instead. Confirm NO lucky-guess button appears.
8. **Negative test 2**: get an answer WRONG. Tap "I guessed". Confirm the existing 🤔 HELP ME UNDERSTAND button appears (wrong-answer flow), NOT the lucky-guess button.

Check the server terminal for an `/api/clarify POST` log entry on the tap. The first tap should show a Claude call (look for a delay of ~1–4s). The retry tap after navigation should be near-instant (cached lookup).

Optional DB spot-check in Supabase:

```sql
SELECT id, answer_kind, total_turns, total_output_tokens, jsonb_array_length(messages) AS msg_count
FROM answer_clarifications
WHERE user_id = '<your-id>'
ORDER BY created_at DESC LIMIT 5;
```

Lucky-guess rows should show `total_turns = 1` and `msg_count = 1` (single-shot — never grows past one message).

- [ ] **Step 6: Commit**

```bash
git add src/components/quiz/QuizEngine.tsx
git commit -m "$(cat <<'EOF'
feat(quiz): wire LuckyGuessExplanation into QuizEngine

One import + one render branch. The predicate (score >= 0.7 AND
confidence === "guessed" AND answerId) is mutually exclusive with the
wrong-answer clarifier's score < 0.7 predicate, so the two never
coexist on a single question.

Manual verification covered all three paths in spec §8:
  - Right + guessed -> lucky-guess button + panel (new)
  - Right + confident -> nothing (existing)
  - Wrong + any confidence -> 🤔 Help me understand (existing)

Cached revisit returns instantly; no Claude call on the second tap.

Spec: docs/superpowers/specs/2026-06-01-lucky-guess-clarifier-design.md §3.5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (hero paragraph + new "What shipped" subsection + tier-3 queue refinement).

- [ ] **Step 1: Verify branch**

Confirm `git branch --show-current` returns `lucky-guess-clarifier`.

- [ ] **Step 2: Update the hero "Current State" paragraph**

Find the existing phrase in the hero paragraph (under `## Current State (Checkpoint — 2026-06-01)`):

```
**confidence-weighted SM-2 on the Quiz path** (4-cell symmetric grid: confident-wrong → quality 0, confident-right → 5, guessed-right → capped at 3; one-line indicator chip in SessionDebrief)
```

Immediately AFTER `... one-line indicator chip in SessionDebrief)`, append:

```
, **lucky-guess clarifier on the Quiz path** (single-shot Loremaster explanation when a right answer was rated as "I guessed" — inline pixel chip, amber + Dice5 vocabulary matching the SessionDebrief lucky-win chip)
```

So the resulting text reads `…one-line indicator chip in SessionDebrief), **lucky-guess clarifier on the Quiz path** (single-shot Loremaster explanation when a right answer was rated as "I guessed" — inline pixel chip, amber + Dice5 vocabulary matching the SessionDebrief lucky-win chip), **adaptive difficulty on regeneration**…`

- [ ] **Step 3: Add a new "What shipped" subsection**

Find the existing subsection `### Confidence-weighted SM-2 on the Quiz path (2026-06-01)`. Find the END of that subsection (it ends with the line `**Spec:** \`docs/superpowers/specs/2026-06-01-confidence-weighted-sm2-design.md\`. Plan: \`docs/superpowers/plans/2026-06-01-confidence-weighted-sm2.md\`. \`docs/\` is gitignored on purpose for laptop-local spec drafts; both files are committed in this round.`).

IMMEDIATELY AFTER that closing line + the trailing blank line, INSERT the new subsection:

```markdown
### Lucky-guess clarifier on the Quiz path (2026-06-01)

Natural follow-on to the confidence-weighted SM-2 shipment from the same day. Closes the loop on the SessionDebrief lucky-win chip: when a student rates a right answer as "I guessed", an inline `HEAR THE LOREMASTER'S TAKE →` pixel chip appears beneath ConfidenceRow. One tap fetches a single-paragraph Loremaster explanation of why the answer is right and what trap made guessing tempting. No multi-turn chat — the single-shot constraint is the pedagogical design.

**Files touched:**
- `src/lib/ai/clarify-answer.ts` — `buildSystemPrompt` is now a thin dispatcher on `(ctx.score, ctx.confidence)`. The legacy body became `buildWrongAnswerPrompt` (unchanged verbatim). New `buildLuckyGuessPrompt` produces a one-paragraph explainer: open by naming the trap, close with the correct reasoning, no preamble, no follow-up question. Loremaster persona applied via the existing `withCoachPersona` wrapper.
- `src/app/api/clarify/route.ts` — added a server-side single-shot guard inside the CONTINUE branch. If the answer is `ai_score >= 0.7 && confidence === "guessed"`, the route returns a classified 409 — defends against any future client trying to send follow-up turns on a lucky-guess row. OPEN branch unchanged.
- `src/components/quiz/LuckyGuessExplanation.tsx` (new, render-only client component) — collapsed → loading → open state machine. NO auto-probe on mount (auto-probing would fire Claude every time the component mounts; spec §3.4). Revisit-within-session requires a re-tap but the cached lookup returns instantly. Amber + Dice5 vocabulary; peer pixel-nail offsets (1.5 + z-[2]).
- `src/components/quiz/QuizEngine.tsx` — one import + one render branch alongside the existing wrong-answer clarifier. Predicate `score >= 0.7 && confidence === "guessed" && answerId` is mutually exclusive with the wrong-answer's `score < 0.7`.

**No migration.** Reuses the polymorphic `answer_clarifications` table from migration 020 — `messages: [oneAssistantTurn]` with `total_turns: 1` is a valid state. The server's existing-row lookup makes revisits cached for free.

**The dispatch (canonical reference):**

```ts
function buildSystemPrompt(ctx: ClarifierContext): string {
  const isLuckyGuess = ctx.score >= 0.7 && ctx.confidence === "guessed";
  return isLuckyGuess ? buildLuckyGuessPrompt(ctx) : buildWrongAnswerPrompt(ctx);
}
```

Both `openClarifier` and `continueClarifier` call this builder unchanged. The dispatcher pattern means future answer-type variants (e.g., "you got partial credit, talk through what's missing") can land as new prompt builders without touching the route or component shape.

**Cost:** single Claude call per lucky-guess answer where the user opts in. Typical output 150–250 tokens (the prompt's 3-5-sentence constraint keeps responses tight). Cached revisits cost zero. `max_tokens` stays at the 1024 default from `openClarifier` — no signature change needed.

**Phase 2 still open:** Review / Boss / Exam clarifier expansion (A2) lifts the `answerKind !== "quiz"` gate for both wrong-answer AND lucky-guess simultaneously. Confidence column needs to land on `review_answers` first; SM-2 modulation in Review `/complete` is the third leg.

**Spec:** `docs/superpowers/specs/2026-06-01-lucky-guess-clarifier-design.md`. Plan: `docs/superpowers/plans/2026-06-01-lucky-guess-clarifier.md`.

```

(The trailing blank line keeps the spacing consistent with peer subsections.)

- [ ] **Step 4: Update the tier-3 queue line**

Find the existing line in the "Active work + queue" section near the bottom of `CLAUDE.md`:

```
- **Phase 2 of confidence + clarifier** — expand to Review / Boss / Exam engines. Add `UNIQUE(answer_kind, answer_id)` on `answer_clarifications` + upsert pattern in the open branch. SM-2 quality changes shipped on the Quiz path 2026-06-01; Review still needs the column + UI + the same modulation in its `/complete`.
```

Replace with:

```
- **Phase 2 of confidence + clarifier** — expand to Review / Boss / Exam engines. Add `UNIQUE(answer_kind, answer_id)` on `answer_clarifications` + upsert pattern in the open branch. SM-2 quality changes + lucky-guess clarifier both shipped on the Quiz path 2026-06-01; Review still needs (1) the `confidence` column + UI, (2) the same SM-2 modulation in its `/complete`, (3) the polymorphic clarifier endpoint to lift its `answerKind !== "quiz"` gate so both wrong-answer and lucky-guess flows light up.
```

- [ ] **Step 5: Verify the edits**

Run `git diff CLAUDE.md` and confirm exactly the three changes above appear in the diff (hero paragraph appendage, new subsection, queue-line replacement). Expect roughly +35 / -1 lines.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(CLAUDE.md): lucky-guess clarifier on Quiz path

Captures the 2026-06-01 follow-on shipment to confidence-weighted SM-2.
Closes the loop on the SessionDebrief lucky-win chip: students who guess
a right answer now get a single-paragraph Loremaster explanation via an
inline pixel chip. Same /api/clarify endpoint, new prompt branch, no
migration.

Hero "Current State" paragraph: added the lucky-guess clarifier mention
alongside the existing confidence-weighted SM-2 phrase. New "What
shipped" subsection captures file pointers, the dispatcher pattern, the
no-auto-probe-on-mount decision, and the Phase 2 follow-up (now requires
three legs in Review).

Tier-3 queue line updated to enumerate the three Phase 2 legs explicitly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

Spec coverage check (matched against `docs/superpowers/specs/2026-06-01-lucky-guess-clarifier-design.md`):

| Spec section | Implemented in |
|---|---|
| §2 Current state | Read-only; informed Task 1's rename + Task 4's render-block placement |
| §3.1 Architecture | All 5 tasks |
| §3.2 Server-side decision tree (`isLuckyGuess` branch + single-shot CONTINUE guard) | Task 1 (prompt branch) + Task 2 (CONTINUE guard) |
| §3.3 The lucky-guess prompt (one paragraph, 3-5 sentences, name the trap, no follow-up) | Task 1, Step 2 — `buildLuckyGuessPrompt` |
| §3.4 LuckyGuessExplanation component (props, state machine, no auto-probe) | Task 3 |
| §3.5 QuizEngine integration (predicate, mutually exclusive with wrong-answer) | Task 4 |
| §3.6 Visual consistency with SessionDebrief lucky-win chip | Task 3 (amber + Dice5 + pixel chrome) |
| §4 Data flow | Task 3 + Task 4 + Task 2 collectively |
| §5 Edge cases (confidence change, soft-replace, network drop, image-only, Hebrew, StrictMode, double-tap) | Task 3 state machine + existing `/api/clarify` patterns; Task 4 manual verification step 6 covers double-tap |
| §6 Error handling (classifyAiError, classified 409 for CONTINUE on lucky-guess) | Task 2 (server) + Task 3 (client toast on failure) |
| §7 Cost | Task 3 single-call POST + cached revisit |
| §8 Testing (no new infra, manual walk-through) | Task 4 Step 5 |
| §9 Out of scope | Honored — no Review/Boss/Exam, no multi-turn follow-up, no image hydration, no analytics |
| §10 CLAUDE.md updates | Task 5 |

Placeholder scan: no "TBD", "TODO", "implement later", "appropriate error handling", or "similar to Task N" patterns present. Every code step shows the exact code; every commit shows the exact message.

Type consistency: `ClarifierContext` (existing type, unchanged) is used by both `buildWrongAnswerPrompt` and `buildLuckyGuessPrompt`. `Status` type in `LuckyGuessExplanation` (`"collapsed" | "loading" | "open"`) is internal and consistent. The predicate `score >= 0.7 && confidence === "guessed"` appears identically in Task 1 (`buildSystemPrompt`), Task 2 (CONTINUE guard), and Task 4 (render branch) — verified by hand.

Ambiguity check: the only step that references "around line N" is Task 1 Step 2 (lines 48-83) and Task 4 Step 2 (lines 1161-1183). Both target uniquely-identifiable functions/render blocks; no ambiguous match. Task 2 Step 2's insertion point is precisely anchored ("immediately AFTER the budget-cap guard").

---

## Execution Notes

- **Total estimated time:** 30–45 min for an attentive implementer. Tasks 1, 2, 5 are mechanical. Task 3 is the longest (new component, ~120 lines of JSX). Task 4 includes the manual verification step (user-driven).
- **Rollback handle:** Task 1's rename is the only thing that changes existing exports' behavior (transparently — both modes call the same dispatcher). If Phase 2 demands a different shape, `git revert` Task 5 → Task 4 → Task 3 → Task 2 → Task 1 cleanly.
- **Branch suggestion:** `lucky-guess-clarifier` off `main`. Run the 5 tasks. Push. Fast-forward merge.

---

**End of plan.**

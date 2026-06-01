# Lucky-Guess Clarifier — Design Spec

**Date:** 2026-06-01
**Branch (planned):** `lucky-guess-clarifier`
**Pilot scope:** Quiz only (Review / Boss / Exam follow in A2 alongside the wrong-answer clarifier's Phase 2 expansion).

---

## 1. Problem & Goal

StudyQuest already has a **"Why was I wrong?" clarifier** that fires when a student gets an answer wrong — a multi-turn Loremaster chat with confidence-aware tone (`src/lib/ai/clarify-answer.ts`, `/api/clarify`, `ClarifierThread.tsx`). It triggers via a `🤔 Help me understand` button visible only when `score < 0.7`.

After yesterday's confidence-weighted SM-2 shipment (2026-06-01, commit `6c7e1e9`), the post-quiz SessionDebrief now also surfaces a **lucky-win chip** when the student tagged an answer as `guessed` but got it right — calling out that the SR scheduler is bringing the topic back sooner because a lucky guess is fragile knowledge. The chip *describes* the situation; it doesn't *do* anything about it.

This shipment closes that loop. **Add a single-shot lucky-guess clarifier** — when the student rates a right answer as "I guessed", a `✨ Hear the Loremaster's take` button appears next to the confidence row. One tap fetches a single-paragraph Loremaster explanation of *why* the answer is right, including the trap that made guessing tempting. No follow-up chat — the use case is "I happened to be right; tell me why so the next time isn't a guess."

**Goal:** turn the lucky-win chip from a passive description into an actionable moment that produces durable understanding from a fragile right answer.

**Non-goal:** multi-turn chat for lucky guesses (single explanation is enough — and consistent with the *pedagogical* difference between "I got this wrong, walk me through it" vs. "I got this right, just want to know why").

## 2. Current state (what we're modifying)

### `src/lib/ai/clarify-answer.ts`

- Exports `openClarifier(ctx)` and `continueClarifier(ctx, history, message)` — both call Claude with a system prompt built by `buildSystemPrompt(ctx)`. That builder currently writes from the assumption *"the student got this wrong (score X/1.0)"* + a confidence-aware tone branch (confident/guessed/null).
- The prompt teaches the model to ask first ("what part is unclear?"), then scaffold an answer over 3 turns max. `max_tokens: 1024` per turn.
- `studentImage: null` is hardcoded (YAGNI on Storage hydration).

### `src/app/api/clarify/route.ts`

- Polymorphic endpoint (Phase 2 will light up Review/Boss/Exam). Pilot rejects non-`quiz` `answerKind` with classified 409.
- Fetches the `quiz_answers` row (incl. `ai_score`, `confidence`, ownership chain through `quiz_sessions!inner`).
- Two branches: OPEN (`!message`) inserts a new row, fires `openClarifier`; CONTINUE (`message` present) appends a turn via `continueClarifier` + UPDATE.
- 6000 total output tokens / session cap with budget-guard at both OPEN/resume and CONTINUE.
- Existing-row lookup uses `.order().limit(1)` (defensive vs. dev StrictMode double-fire).

### `src/components/quiz/QuizEngine.tsx`

- Per-question state already includes `confidence`, `clarifierOpen`, `answerId` (per-question).
- Existing button below the feedback block (only when `score < 0.7`):
  ```tsx
  <Button onClick={() => setQState(q.id, { clarifierOpen: true })}>
    🤔 Help me understand
  </Button>
  ```
  Followed by `<ClarifierThread answerId={...} />` when open.

### `src/components/quiz/ClarifierThread.tsx`

- Chat UI — input box, send button, message history. Not reused here; the new component is render-only.

### `src/components/quiz/ConfidenceRow.tsx`

- Three-button confidence picker. Renders inline after grading. Tap fires `PATCH /api/quiz/answers/[id]/confidence`. Unchanged this round.

## 3. Design

### 3.1 Architecture overview

Three touch points; all small.

```
src/lib/ai/clarify-answer.ts                 +1 prompt builder + 1 export
src/app/api/clarify/route.ts                 ~30 line branch
src/components/quiz/LuckyGuessExplanation.tsx  NEW (render-only client component)
src/components/quiz/QuizEngine.tsx           ~15 line render block + state field
```

No migration. No new tables. No new API routes. No env vars. The existing polymorphic `answer_clarifications` table accommodates the new use case — `messages: [oneEntry]` is a valid state.

### 3.2 Server-side decision tree

The route's `buildSystemPrompt` becomes a branch on the answer's `(ai_score, confidence)` pair (both already loaded from `quiz_answers`):

```ts
function buildSystemPrompt(ctx: ClarifierContext): string {
  const isLuckyGuess = ctx.score >= 0.7 && ctx.confidence === "guessed";
  return isLuckyGuess
    ? buildLuckyGuessPrompt(ctx)
    : buildWrongAnswerPrompt(ctx);
}
```

`buildWrongAnswerPrompt` is the existing `buildSystemPrompt` body (just renamed). `buildLuckyGuessPrompt` is new (§3.3).

**Single-shot enforcement** at the CONTINUE branch:

```ts
// Existing CONTINUE branch starts with:
if (!existing) { return /* 404 */; }
// (budget guard...)
// ── NEW: lucky-guess answers don't support follow-up turns ──
const isLuckyGuess =
  ctx.score >= 0.7 && answerRow.confidence === "guessed";
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

The client never sends CONTINUE for lucky-guess (no UI for it), but the server enforces the constraint independently — defense in depth + future-proofs against a stray follow-up call from any future client.

**Response shape** is unchanged: `{ clarificationId, messages }` on success; classified error envelope on failure.

### 3.3 The lucky-guess prompt

Single Loremaster paragraph, ~150–250 output tokens.

```ts
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
```

Wrapped with `withCoachPersona(...)` for Loremaster voice (same as the wrong-answer prompt).

**Claude params:**
- `model: "claude-sonnet-4-6"` (same as the wrong-answer clarifier)
- `max_tokens: 1024` (unchanged from `openClarifier` — the function is reused as-is)
- Single user message: `"start"` (matches the opener pattern in `openClarifier`)

**Implementation note:** `openClarifier` is reused as-is for lucky-guess. The branch is purely in the prompt builder. The lucky-guess prompt's structural constraints (one paragraph, 3–5 sentences) will keep actual output well under 1024 tokens — typical generation lands at 150–250 output tokens (see §7 cost). Changing `openClarifier`'s signature for a tighter cap isn't worth the surface area. If output cost ever becomes a real concern, narrow this later via a dedicated `openLuckyGuessClarifier` function or a per-call `max_tokens` override.

### 3.4 `LuckyGuessExplanation` component

New client component at `src/components/quiz/LuckyGuessExplanation.tsx`.

**Props:**
```ts
interface LuckyGuessExplanationProps {
  answerId: string;
}
```

**State:**
```ts
const [status, setStatus] = useState<"collapsed" | "loading" | "open" | "error">("collapsed");
const [content, setContent] = useState<string | null>(null);
```

**On mount:** stay collapsed. Do NOT probe `/api/clarify` automatically — the existing OPEN branch fires Claude when no cached row exists, so auto-probing every lucky-guess answer would spend tokens for explanations the user never reads. The user's tap on the button is the opt-in moment.

**Revisit-within-session behavior:** if the user navigates to the next question and then back, the component unmounts/remounts in collapsed state. A re-tap returns the cached message instantly (server's existing-row lookup hits, zero Claude calls). Trade-off: one extra tap per revisit instead of auto-restore — accepted to avoid the risk of firing Claude on mount.

**Collapsed state:**

```tsx
<button
  onClick={open}
  className="pixel-border bg-amber-500/10 text-amber-200 hover:bg-amber-500/15 ..."
>
  <Dice5 className="w-4 h-4" aria-hidden /> Hear the Loremaster's take →
</button>
```

Amber palette + Dice5 icon — matches the lucky-win chip vocabulary from SessionDebrief (visual consistency).

**Loading state:** the button shows `<Loader2 className="animate-spin" />` + text `"Consulting the tome…"`. Disabled.

**Open state:**

```tsx
<motion.div
  initial={{ opacity: 0, y: 4 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
  className="pixel-border bg-amber-500/10 p-4 relative"
  role="region"
  aria-label="Loremaster's take"
>
  {/* 4 pixel-nail corners (amber, w-1.5 h-1.5, z-[2], top-1.5/right-1.5/bottom-1.5/left-1.5 — peer vocabulary) */}
  <div className="flex items-center gap-2 mb-2">
    <Dice5 aria-hidden className="w-4 h-4 text-amber-400" />
    <span className="font-pixel text-[9px] tracking-wider text-amber-400">
      LOREMASTER'S TAKE
    </span>
  </div>
  <MarkdownContent>{content}</MarkdownContent>
</motion.div>
```

`MarkdownContent` for prose (block context, LaTeX-aware). RTL inherits from QuizEngine parent (no forced `dir`).

**Error state:** the button reverts to collapsed and a sonner toast fires with the classified `userMessage`.

### 3.5 QuizEngine integration

Add a render branch in the per-question feedback block, after the existing wrong-answer clarifier branch:

```tsx
{/* Existing wrong-answer clarifier (score < 0.7) */}
{isAnswered && curState.result && curState.result.score < 0.7 && curState.confidence != null && curState.answerId && (
  /* ...existing 🤔 Help me understand button + ClarifierThread... */
)}

{/* NEW: lucky-guess explanation (right answer + guessed) */}
{isAnswered && curState.result && curState.result.score >= 0.7 && curState.confidence === "guessed" && curState.answerId && (
  <LuckyGuessExplanation answerId={curState.answerId} />
)}
```

The two branches are mutually exclusive (score < 0.7 vs. >= 0.7). No state coordination needed.

**No new per-question state field is required** — `LuckyGuessExplanation` owns its own collapsed/open/loading state internally. Question navigation unmounts/remounts the component (state resets to collapsed). A re-tap on the button returns the cached message instantly — the small extra friction is accepted to avoid threading more state through QuizEngine's per-question Map. If revisit-friction becomes a real annoyance, the next iteration can add `luckyGuessOpen` to per-question state without touching the rest of the design.

### 3.6 Visual consistency

The lucky-guess UI shares its color family with the SessionDebrief lucky-win chip:

| Element | Background | Text | Icon | Border |
|---|---|---|---|---|
| SessionDebrief lucky-win chip | `bg-amber-500/10` | `text-amber-200` | `Dice5` | `pixel-border` + amber nails |
| LuckyGuessExplanation button | `bg-amber-500/10` | `text-amber-200` | `Dice5` | `pixel-border` |
| LuckyGuessExplanation expanded | `bg-amber-500/10` | inherit | `Dice5` + `LOREMASTER'S TAKE` pixel label | `pixel-border` + amber nails |

A user who sees the chip on the debrief screen sees the same color/icon vocabulary inline after their next guessed-right answer — the visual story stays coherent.

## 4. Data flow

```
QuizEngine                                  (per-question)
    │
    │  user submits answer
    ▼
POST /api/quiz/answers              quiz_answers row created with confidence: null
    │
    │  user taps confidence: "guessed" on a right answer
    ▼
PATCH /api/quiz/answers/[id]/confidence    confidence updated to "guessed"
    │
    │  predicate: score >= 0.7 && confidence === "guessed" && answerId
    ▼
<LuckyGuessExplanation answerId={...} /> mounts (collapsed)
    │
    │  user taps "Hear the Loremaster's take"
    ▼
POST /api/clarify { answerKind: "quiz", answerId }
    │
    │  existingRows lookup against answer_clarifications:
    │
    ├─→ Cached row exists (revisit)?
    │       │
    │       └─→ YES: return { clarificationId, messages: [cached] } → no Claude call
    │
    ├─→ No cached row (first open)?
    │       │
    │       └─→ buildSystemPrompt detects isLuckyGuess (score >= 0.7 + confidence === "guessed")
    │           → buildLuckyGuessPrompt
    │           → openClarifier (one Claude call, ~150–250 output tokens typical)
    │           → INSERT into answer_clarifications: { messages: [opener], total_turns: 1 }
    │           → return { clarificationId, messages: [opener] }
    │
    ├─→ Component expands, MarkdownContent renders messages[0].content
```

## 5. Edge cases

| Case | Behavior |
|------|----------|
| User taps "I guessed" then changes to "Confident" before opening the explanation | PATCH overwrites confidence. QuizEngine re-renders, predicate fails, the button vanishes. Any orphan `answer_clarifications` row (none should exist yet — Claude never fired) stays harmless. |
| User taps "I guessed", opens the explanation, then changes to "Confident" | Same predicate failure → component unmounts. The cached row stays in the DB. If they switch back to "Guessed" later, the component remounts and re-fetches the cached row (no new Claude call). |
| Question is regenerated mid-session (soft-replace) | The cached explanation references the OLD `quiz_answer.id`. The new question gets its own answer row + its own (potentially future) lucky-guess explanation. Old explanation is invisible. |
| Mid-quiz network drop on the tap | `classifyAiError` returns a classified body; client toasts the `userMessage`. Component returns to collapsed; user can retry. |
| Question is open-answer image-only (no text) | The prompt's fallback string says `"(the student submitted a diagram only — the image is NOT available to you in this conversation. Reference what the correct answer would be in prose.)"` (mirrors the wrong-answer clarifier's honest-fallback pattern from `35a4f2d`). |
| Hebrew quiz | Prompt rule `match the student's language` (already in `withCoachPersona`); `MarkdownContent` inherits parent `dir`. |
| React 19 StrictMode dev double-fire of the OPEN useEffect (creates 2 rows for same `answerId`) | Existing `.order().limit(1)` defensive read pattern in `/api/clarify` handles this. (Phase 2 will add `UNIQUE(answer_kind, answer_id)` at the schema level.) |
| User taps the button twice quickly | Status is set to `"loading"` on the first tap; button is disabled in that state. Second tap is a no-op. |

## 6. Error handling

- Claude failure → `classifyAiError` → `{ error: { code, userMessage, retryable } }` with HTTP 502. Client toasts via `readClassifiedErrorFromResponse`. Component returns to collapsed.
- Server-side CONTINUE rejection (someone tries to follow up on a lucky-guess) → classified 409. Client doesn't surface this because no UI sends CONTINUE, but the error envelope is consistent.
- Auth / 404 / ownership errors → existing classified envelopes (unchanged).
- DB UPDATE/INSERT failures → existing CONTINUE-branch and OPEN-branch error handling unchanged.

## 7. Cost

| Event | Claude calls | Cost (Sonnet 4.6, ~$3/MTok output) |
|---|---|---|
| User taps the button on a lucky-guess answer (first time) | 1 × `openClarifier` | ~150–250 output tokens × $3/1M = **$0.0005–$0.0008** |
| Revisit (refresh, navigate back) | 0 — cached message returned | $0 |
| Average session with 1 lucky-guess and the user taps to read | ~$0.001 |
| Worst case: a 10-question session where 5 answers are lucky-guesses and the student reads all 5 | ~$0.004 |

Comparable to the wrong-answer clarifier per-question cost; one shot is cheaper than the wrong-answer's 1–3 turn average.

## 8. Testing

No new test infrastructure. Matches the existing pure-helper convention (no test files in `src/`). Manual verification plan:

1. Take a quiz on any topic. Get one question RIGHT and rate confidence as **I guessed**.
2. Confirm a `✨ Hear the Loremaster's take →` button appears under the ConfidenceRow.
3. Tap. Confirm:
   - Button switches to `Consulting the tome…` with spinner.
   - After ~1–3 seconds, an amber pixel-bordered panel with `LOREMASTER'S TAKE` label expands below.
   - The paragraph (3–5 sentences) names a trap and explains the correct reasoning.
4. Navigate away and back. Confirm the explanation reappears without a new Claude call (no spinner — instant expand). Server log should show NO new `/api/clarify` entry.
5. Open browser console / dev terminal. Check that the `/api/clarify` POST returns `{ clarificationId, messages: [{ role: "assistant", content: ... }] }` and that no CONTINUE call has fired.
6. In Supabase, check the `answer_clarifications` table: one row per lucky-guess with `total_turns: 1`, `messages` containing exactly one assistant message.

## 9. Not in scope

- **Lucky-guess on Review / Boss / Exam.** Same Phase 2 gate as the wrong-answer clarifier. The `/api/clarify` route already rejects non-`quiz` `answerKind` with classified 409 — Phase 2 (A2) lifts that for both wrong-answer and lucky-guess simultaneously.
- **Multi-turn follow-up.** Single-shot is the pedagogical design. If the user wants more, they can use other surfaces (the cheat sheet, the topic page, a fresh question on the topic).
- **Voice / TTS readout.** Deferred globally.
- **Analytics on open rate / explanation quality.** No telemetry layer exists today; not adding one for this feature.
- **A "Re-explain" / "Try a different angle" button.** Single-shot constraint covers this case via "match the student's language and tone." If the explanation is bad, the path forward is regenerating the QUESTION (existing Regenerate button), not the explanation.
- **Image-aware explanations.** `studentImage: null` stays hardcoded (matches the existing wrong-answer clarifier YAGNI).

## 10. CLAUDE.md updates after shipping

Once merged:

- Hero "Current State" paragraph: add `**lucky-guess clarifier on the Quiz path**` near the existing `confidence-weighted SM-2 on the Quiz path` mention.
- New "What shipped" subsection (`### Lucky-guess clarifier (2026-06-XX)`) with file pointers, the prompt structure summary, the cache-via-`answer_clarifications` decision, and the single-shot enforcement note.
- Tier-3 queue line update: the existing Phase 2 confidence + clarifier line gains the note that *both* clarifier modes (wrong-answer + lucky-guess) need Review/Boss/Exam expansion together.

---

**End of spec.**

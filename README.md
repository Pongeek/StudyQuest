# StudyQuest

> A gamified study platform that turns any PDF into an academic RPG journey. Upload a course PDF, and Claude extracts episodes, topics, and quiz questions. Master each topic, level up, defeat episode bosses, and watch your knowledge map come alive.

Built with **Next.js 16**, **React 19**, **Tailwind v4**, **Supabase**, **Clerk**, and the **Anthropic API**.

---

## ✨ Features

### Core learning loop
- 📄 **PDF → Course extraction** - drop in a syllabus or textbook PDF; Claude classifies it into episodes and topics
- 📚 **Per-episode upload pipeline** - upload one chapter PDF at a time (up to 32 MB; 20 MB warning tier) so big textbooks stay snappy and reliable
- 🎯 **Mixed-format quizzes** - multiple-choice + open-ended questions per topic, AI-graded with feedback
- 🖼️ **Image answers** - attach a hand-drawn diagram (automata, derivations, proofs); Claude vision grades the picture alongside the typed answer
- 🐍 **Boss fights** - comprehensive end-of-episode challenges covering every topic in the episode
- 📑 **Exam prep mode** - upload past exams; Claude extracts real questions for timed or untimed practice with a real-exam debrief at the end
- 🧠 **Spaced repetition** - SM-2 algorithm schedules review sessions so things actually stick
- 🎓 **Feynman mode** - teach a topic back to a curious AI student to prove deeper understanding
- 📕 **Mistake Grimoire** - questions you've failed twice surface as "demons" to slay
- 🤔 **"Why was I wrong?" clarifier** - inline multi-turn chat with the Loremaster after a wrong quiz answer; confidence-aware so it meets you where you are (currently Quiz-only; Review/Boss/Exam coming)
- 🔄 **Regenerate question** - swap an ambiguous or hallucinated AI question for a fresh variant on the same concept (old row soft-replaced so quiz history stays intact)
- 📜 **Per-topic cheat sheet** - one-page Markdown + LaTeX summary on demand; cached per topic, Hebrew + math rendered correctly

### Gamification & dopamine
- 🏆 **XP, levels, ranks** - every answer earns XP; level-up moments are full-screen celebrations
- 🎖️ **6-tier rank progression** - Novice → Apprentice → Adept → Expert → Master → Sage, each with distinct frame chrome, glow, and accent color; tier crossings fire a full "RANK UP!" overlay with the new tier's identity as the reveal
- 🔥 **Streaks + ❄ freeze tokens** - daily-study streak with rescue prompts before it breaks; earn 1 freeze token per 7-day streak (max 3) that automatically bridges a missed day so a single off-day doesn't wipe weeks of progress
- ⭐ **Mastery tiers** - each topic evolves through Novice → Apprentice → Adept → Expert → Master, with distinct visual treatments per tier on the course map
- 🎰 **Slot-machine achievements** - rare random unlocks alongside skill-based ones
- 🎵 **Sound design** - Web Audio synth (no asset files) reacts to correct/wrong, combos, level-ups, and grading completion
- ✨ **Topic Evolution** - when you bump a topic to a new mastery tier, the matching node on the course map plays a one-shot celebration (spring scale + amber burst + sound + toast)
- 📜 **Daily Scroll of Wisdom** - once-a-day AI-generated insight from one of your courses

### UI polish
- 🎨 **Pixel-elegant Hero HUD** - distinct level frame, rank chip, segmented XP bar, pixel-font stat labels - shared across dashboard, profile, and landing
- 🎯 **Smart Next Best Action widget** - cycling dashboard pill that picks the single highest-value next move (exam crunch, streak save, boss ready, demon pile, due reviews, today's quest); paired with the Exam Countdown card in one urgency row
- 📊 **Today's stats strip** - slim row under the hero showing today's questions / accuracy / minutes / XP; hides cleanly on a fresh-morning visit
- 🔮 **Subject-icon sigils** - each course tile picks a thematic Lucide icon (atom, flask, brain, sword, …) from its subject so the realm grid reads at a glance
- 🌀 **Grading Overlay** - animated sigil + cycling status messages while Claude grades your session
- 🌌 **Particle backgrounds**, **course map**, **achievement progress ring**, **study activity heatmap**
- 🌍 **Hebrew & RTL support** - Hebrew courses render right-to-left throughout (questions, feedback, debriefs, cheat sheets, tables) with `dir="auto"` on every input
- ♿ **WCAG AA contrast**, full keyboard navigation, `prefers-reduced-motion` respected

---

## 🧰 Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, RSC by default) |
| UI | React 19, TypeScript, Tailwind v4 (CSS-first config), shadcn/ui, Radix primitives, lucide-react |
| Motion | Framer Motion + CSS keyframes |
| Toasts | sonner |
| Auth | Clerk |
| Database | Supabase (Postgres) with `@supabase/ssr` |
| AI | Anthropic SDK (Claude) |
| PDF parsing | `unpdf` (server) + `react-pdf` (viewer) |
| Math rendering | KaTeX (`rehype-katex` + `remark-math`) |

---

## 🚀 Getting started locally

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/studyquest.git
cd studyquest
npm install
```

### 2. Set up the third-party services

You'll need accounts on three services (all have generous free tiers):

#### Supabase
1. Create a new project at [supabase.com](https://supabase.com)
2. Once it's ready, run every SQL file in `supabase/migrations/` in order (Dashboard → SQL Editor → paste each, run, next). They create the `users`, `courses`, `episodes`, `topics`, `questions`, `quiz_sessions`, `achievements`, etc. tables that the app needs.
3. From **Project Settings → API**, copy your project URL, anon key, and **service_role key** - you'll need these in step 3.

#### Clerk
1. Create an application at [clerk.com](https://clerk.com)
2. Configure sign-in/sign-up methods (email + password is enough to start)
3. From **API Keys**, copy your publishable key and secret key.

#### Anthropic
1. Get an API key at [console.anthropic.com](https://console.anthropic.com)
2. Make sure your account has billing set up - Claude calls are pay-as-you-go.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the values you collected above. **Do not commit this file.**

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up via Clerk → land on the dashboard → upload a PDF → start your first quest.

---

## ☁️ Deploying to Vercel

The fastest path:

1. **Push to GitHub.**
2. Go to [vercel.com/new](https://vercel.com/new) and import your repo.
3. Vercel auto-detects Next.js - leave the build settings alone.
4. In **Settings → Environment Variables**, paste every variable from your `.env.local` (set `NEXT_PUBLIC_APP_URL` to your eventual Vercel URL, e.g. `https://studyquest-yourname.vercel.app`).
5. Deploy.

### After the first deploy

- **Update Clerk** with your production domain: Clerk Dashboard → Domains → add your `*.vercel.app` URL so Clerk-hosted flows redirect back to your app.
- **Update Supabase Auth allowed URLs** (only relevant if you use Supabase Auth - not needed for this project, but if you swap auth providers later).
- **Re-run migrations** if you connected a *different* Supabase project for production.

### Caveats worth knowing

- **PDF upload size**: the client-side dropzone blocks uploads over **32 MB** (Anthropic's PDF document-block ceiling) and warns at **20 MB** (extraction may take several minutes). `next.config.ts` still permits larger request bodies via the proxy, but Vercel functions have their own limits (4.5 MB body on Hobby, larger on Pro). For big textbooks, use the per-episode upload flow — one chapter PDF per episode keeps each request well under the limit.
- **Long AI calls**: course extraction and exam processing run with `maxDuration: 300` (5 min). Vercel Hobby allows up to 60s of execution per function - Pro extends this. If you're on Hobby and your PDFs are large, processing may time out.
- **Claude API costs**: every quiz, exam debrief, Feynman exchange, and daily Scroll calls Claude. Demoing this to friends with 5-10 users is fine; viral usage will rack up bills fast.

---

## 📁 Project layout

```
src/
  app/                  # App Router routes (RSC by default)
    api/                # Route handlers - quiz/exam/boss/review/feynman/grimoire/scroll
    dashboard/          # Authed app shell
    sign-in/, sign-up/  # Clerk
    globals.css         # Tailwind v4 theme + custom RPG / HUD utilities
  components/
    ui/                 # shadcn primitives (don't put game UI here)
    gamification/       # XPBar, LevelBadge, QuestBoard, QuestCard, StreakCounter
    quiz/, exam/, review/, feynman/  # Per-session-type engines + summaries
    course/             # CourseMap, CourseUploadForm, TopicPDFViewer
    dashboard/          # Authed dashboard surfaces
    landing/            # Public landing page
    effects/            # Particles, confetti, motion overlays, XPBurst, GradingOverlay
  lib/
    ai/                 # Anthropic + prompt logic
    pdf/                # PDF parsing
    supabase/           # Server/browser clients
    xp.ts               # XP curve + level math (single source of truth)
    spaced-repetition.ts # SM-2 implementation
    sound.ts, useSound.ts # Web Audio synth + React glue
  proxy.ts              # Next 16 request interception (renamed from middleware.ts)
supabase/
  migrations/           # SQL migrations - run in order
```

For deeper internal conventions, see [CLAUDE.md](./CLAUDE.md). For Next.js 16-specific gotchas, see [AGENTS.md](./AGENTS.md).

---

## 🛡️ Security notes

- `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, and `CLAUDE_API_KEY` are **server-only**. They are never bundled into the client. Don't paste them anywhere public.
- Anything prefixed `NEXT_PUBLIC_` is browser-exposed by design and safe to share.
- If you ever leak a secret, **rotate it immediately** - every service above has a "regenerate key" button.

---

## 📜 Scripts

```bash
npm run dev      # next dev - hot reload at localhost:3000
npm run build    # next build - production build (also runs in Vercel CI)
npm run start    # next start - serve the production build locally
npm run lint     # eslint
```

---

Built with Claude as a coding partner. Designed to feel like leveling up - clean, motivating, and a little bit magical.

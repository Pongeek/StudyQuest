import { cn } from "@/lib/utils";

/**
 * StudyQuest brand marks.
 *
 * - `StudyQuestIcon`  — the primary mark (sword × pencil behind an open book).
 *   Tuned for dark surfaces (the app's only surface).
 * - `StudyQuestFavicon` — simplified two-stroke mark that survives 16/32 px.
 * - `StudyQuestWordmark` — "Study" + amber "Quest" text.
 * - `StudyQuestLogo` — icon + wordmark lockup (horizontal or stacked).
 * - `AnimatedStudyQuestMark` — 5s sword-fight loop for hero/auth moments.
 *
 * Every SVG is sized via the wrapping element (className / style); the
 * viewBox is locked to 200×200 so it scales cleanly from 16 px favicons to
 * giant hero blocks.
 */

interface SvgProps {
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Primary icon · sword + pencil behind an open book, emerald XP sparkle
// ─────────────────────────────────────────────────────────────────────────────

export function StudyQuestIcon({
  className,
  style,
  title = "StudyQuest",
}: SvgProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
      style={style}
    >
      <title>{title}</title>

      {/* Sword — top-left → bottom-right */}
      <g transform="rotate(-45 100 100)">
        <circle cx="100" cy="166" r="6" fill="#F59E0B" />
        <rect x="96" y="138" width="8" height="24" rx="1.5" fill="#0F0C2E" />
        <rect x="80" y="130" width="40" height="7" rx="2" fill="#F59E0B" />
        <path
          d="M 92 130 L 108 130 L 105 50 L 100 38 L 95 50 Z"
          fill="#F4F1FF"
          stroke="#0F0C2E"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <line x1="100" y1="128" x2="100" y2="52" stroke="#CBD5E1" strokeWidth="1.5" />
      </g>

      {/* Pencil — top-right → bottom-left */}
      <g transform="rotate(45 100 100)">
        <rect x="92" y="148" width="16" height="14" rx="3" fill="#F59E0B" />
        <rect x="92" y="138" width="16" height="11" fill="#E2E8F0" stroke="#0F0C2E" strokeWidth="2" />
        <line x1="92" y1="141.5" x2="108" y2="141.5" stroke="#0F0C2E" strokeWidth="1" />
        <line x1="92" y1="145.5" x2="108" y2="145.5" stroke="#0F0C2E" strokeWidth="1" />
        <rect x="92" y="50" width="16" height="90" fill="#F59E0B" stroke="#0F0C2E" strokeWidth="2.4" />
        <line x1="96" y1="60" x2="96" y2="138" stroke="#0F0C2E" strokeWidth="0.8" opacity="0.4" />
        <line x1="104" y1="60" x2="104" y2="138" stroke="#0F0C2E" strokeWidth="0.8" opacity="0.4" />
        <path
          d="M 92 50 L 108 50 L 104 36 L 96 36 Z"
          fill="#FCD34D"
          stroke="#0F0C2E"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path d="M 96 36 L 104 36 L 100 26 Z" fill="#0F0C2E" />
      </g>

      {/* Open book — covers the crossing point */}
      <g>
        <path
          d="M 38 122 Q 70 110 100 116 Q 130 110 162 122 L 162 152 Q 130 142 100 148 Q 70 142 38 152 Z"
          fill="#0F0C2E"
        />
        <path
          d="M 42 120 Q 68 110 98 116 L 98 146 Q 68 140 42 150 Z"
          fill="#FEF3C7"
          stroke="#0F0C2E"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M 102 116 Q 132 110 158 120 L 158 150 Q 132 140 102 146 Z"
          fill="#FEF3C7"
          stroke="#0F0C2E"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <line x1="100" y1="116" x2="100" y2="148" stroke="#0F0C2E" strokeWidth="2.4" />
        <line x1="54" y1="124" x2="88" y2="121" stroke="#1E1B4B" strokeWidth="1.6" opacity="0.55" />
        <line x1="54" y1="132" x2="88" y2="129" stroke="#1E1B4B" strokeWidth="1.6" opacity="0.55" />
        <line x1="112" y1="121" x2="146" y2="124" stroke="#1E1B4B" strokeWidth="1.6" opacity="0.55" />
        <line x1="112" y1="129" x2="146" y2="132" stroke="#1E1B4B" strokeWidth="1.6" opacity="0.55" />
      </g>

      {/* Emerald XP sparkle, top-right */}
      <g transform="translate(160 44)">
        <path
          d="M 0 -10 L 2.4 -2.4 L 10 0 L 2.4 2.4 L 0 10 L -2.4 2.4 L -10 0 L -2.4 -2.4 Z"
          fill="#10B981"
        />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Simplified favicon · two-stroke crossed shapes behind a bold book
// ─────────────────────────────────────────────────────────────────────────────

export function StudyQuestFavicon({
  className,
  style,
  title = "StudyQuest",
}: SvgProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
      style={style}
    >
      <title>{title}</title>

      <g transform="rotate(-45 100 100)">
        <circle cx="100" cy="166" r="7" fill="#F59E0B" />
        <rect x="95" y="136" width="10" height="26" rx="2" fill="#F59E0B" />
        <rect x="76" y="128" width="48" height="9" rx="3" fill="#F59E0B" />
        <path
          d="M 90 130 L 110 130 L 106 46 L 100 32 L 94 46 Z"
          fill="#F4F1FF"
          stroke="#F4F1FF"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>

      <g transform="rotate(45 100 100)">
        <rect x="90" y="146" width="20" height="16" rx="4" fill="#F59E0B" />
        <rect x="90" y="136" width="20" height="11" fill="#F4F1FF" />
        <rect x="90" y="46" width="20" height="92" fill="#F59E0B" />
        <path d="M 90 46 L 110 46 L 105 30 L 95 30 Z" fill="#FCD34D" />
        <path d="M 95 30 L 105 30 L 100 18 Z" fill="#F4F1FF" />
      </g>

      <g>
        <path
          d="M 34 120 Q 68 106 100 114 Q 132 106 166 120 L 166 156 Q 132 144 100 150 Q 68 144 34 156 Z"
          fill="#F59E0B"
        />
        <path
          d="M 38 118 Q 68 106 98 114 L 98 148 Q 68 142 38 152 Z"
          fill="#FEF3C7"
        />
        <path
          d="M 102 114 Q 132 106 162 118 L 162 152 Q 132 142 102 148 Z"
          fill="#FEF3C7"
        />
        <line x1="100" y1="114" x2="100" y2="150" stroke="#F59E0B" strokeWidth="3" />
      </g>

      <circle cx="160" cy="46" r="9" fill="#10B981" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wordmark — "Study" + amber "Quest"
// ─────────────────────────────────────────────────────────────────────────────

interface WordmarkProps {
  className?: string;
  style?: React.CSSProperties;
}

export function StudyQuestWordmark({ className, style }: WordmarkProps) {
  return (
    <span
      className={cn(
        "font-extrabold tracking-tight leading-none text-white",
        className,
      )}
      style={style}
    >
      Study<span className="text-amber-400">Quest</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lockup — icon + wordmark
// ─────────────────────────────────────────────────────────────────────────────

interface LockupProps {
  orientation?: "horizontal" | "stacked";
  /** Pixel size of the icon mark — wordmark scales relative to it. */
  size?: number;
  tagline?: string;
  className?: string;
}

export function StudyQuestLogo({
  orientation = "horizontal",
  size = 56,
  tagline,
  className,
}: LockupProps) {
  // Wordmark sits at ~52% the icon size so the visual weight reads as a single
  // lockup at every scale.
  const wordPx = Math.round(size * 0.52);

  if (orientation === "stacked") {
    return (
      <div className={cn("inline-flex flex-col items-center gap-4", className)}>
        <StudyQuestIcon className="block" style={{ width: size, height: size }} />
        <StudyQuestWordmark style={{ fontSize: wordPx }} />
        {tagline ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-slate-500">
            {tagline}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <StudyQuestIcon style={{ width: size, height: size }} />
      <div className="flex flex-col leading-none">
        <StudyQuestWordmark style={{ fontSize: wordPx }} />
        {tagline ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-slate-500 mt-2">
            {tagline}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated mark — 8s emblem-assembly loop
//   Beat plan:
//     0.0–1.0s  book lands · anchors the emblem
//     0.6–2.2s  sword glides in from upper-right · settles at -45°
//     1.2–2.9s  pencil slides in from upper-left · settles at +45°
//     2.9–7.4s  sparkle blooms · amber glow swells · "+10 XP" floats up · hold
//     7.4–8.0s  fade-out, return to rest position
// ─────────────────────────────────────────────────────────────────────────────

export function AnimatedStudyQuestMark({ className, title = "StudyQuest" }: SvgProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={cn("sq-mark", className)}
    >
      <title>{title}</title>
      <defs>
        <radialGradient id="sq-emblem-glow" cx="50%" cy="58%" r="45%">
          <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.6" />
          <stop offset="55%" stopColor="#F59E0B" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft warm glow that swells once the emblem is assembled */}
      <circle className="sq-a-glow" cx="100" cy="118" r="72" fill="url(#sq-emblem-glow)" />

      {/* SWORD — glides in from upper-right and settles at -45° */}
      <g transform="translate(100 100)">
        <g className="sq-a-sword">
          <circle cx="0" cy="66" r="6" fill="#F59E0B" />
          <rect x="-4" y="38" width="8" height="24" rx="1.5" fill="#0F0C2E" />
          <rect x="-20" y="30" width="40" height="7" rx="2" fill="#F59E0B" />
          <path
            d="M -8 30 L 8 30 L 5 -50 L 0 -62 L -5 -50 Z"
            fill="#F4F1FF"
            stroke="#0F0C2E"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <line x1="0" y1="28" x2="0" y2="-50" stroke="#CBD5E1" strokeWidth="1.4" />
        </g>
      </g>

      {/* PENCIL — slides in from upper-left and settles at +45° */}
      <g transform="translate(100 100)">
        <g className="sq-a-pencil">
          <rect x="-8" y="48" width="16" height="14" rx="3" fill="#F59E0B" />
          <rect x="-8" y="38" width="16" height="11" fill="#E2E8F0" stroke="#0F0C2E" strokeWidth="2" />
          <line x1="-8" y1="41.5" x2="8" y2="41.5" stroke="#0F0C2E" strokeWidth="1" />
          <line x1="-8" y1="45.5" x2="8" y2="45.5" stroke="#0F0C2E" strokeWidth="1" />
          <rect x="-8" y="-50" width="16" height="90" fill="#F59E0B" stroke="#0F0C2E" strokeWidth="2.4" />
          <line x1="-4" y1="-40" x2="-4" y2="38" stroke="#0F0C2E" strokeWidth="0.8" opacity="0.4" />
          <line x1="4" y1="-40" x2="4" y2="38" stroke="#0F0C2E" strokeWidth="0.8" opacity="0.4" />
          <path
            d="M -8 -50 L 8 -50 L 4 -64 L -4 -64 Z"
            fill="#FCD34D"
            stroke="#0F0C2E"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path d="M -4 -64 L 4 -64 L 0 -74 Z" fill="#0F0C2E" />
        </g>
      </g>

      {/* BOOK — lands first, anchors the emblem, rendered on top of weapons */}
      <g className="sq-a-book">
        <path
          d="M 38 122 Q 70 110 100 116 Q 130 110 162 122 L 162 152 Q 130 142 100 148 Q 70 142 38 152 Z"
          fill="#0F0C2E"
        />
        <path
          d="M 42 120 Q 68 110 98 116 L 98 146 Q 68 140 42 150 Z"
          fill="#FEF3C7"
          stroke="#0F0C2E"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M 102 116 Q 132 110 158 120 L 158 150 Q 132 140 102 146 Z"
          fill="#FEF3C7"
          stroke="#0F0C2E"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <line x1="100" y1="116" x2="100" y2="148" stroke="#0F0C2E" strokeWidth="2.4" />
        <line x1="54" y1="124" x2="88" y2="121" stroke="#1E1B4B" strokeWidth="1.6" opacity="0.55" />
        <line x1="54" y1="132" x2="88" y2="129" stroke="#1E1B4B" strokeWidth="1.6" opacity="0.55" />
        <line x1="112" y1="121" x2="146" y2="124" stroke="#1E1B4B" strokeWidth="1.6" opacity="0.55" />
        <line x1="112" y1="129" x2="146" y2="132" stroke="#1E1B4B" strokeWidth="1.6" opacity="0.55" />
      </g>

      {/* SPARKLE — single emerald bloom that finishes the emblem */}
      <g className="sq-a-spark" transform="translate(158 50)">
        <path
          d="M 0 -10 L 2.4 -2.4 L 10 0 L 2.4 2.4 L 0 10 L -2.4 2.4 L -10 0 L -2.4 -2.4 Z"
          fill="#10B981"
        />
        <circle cx="0" cy="0" r="2" fill="#FEF3C7" />
      </g>

      {/* "+10 XP" floats up late in the loop */}
      <g className="sq-a-xp" transform="translate(146 58)">
        <text
          x="0"
          y="0"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize="13"
          fontWeight="600"
          fill="#10B981"
        >
          +10 XP
        </text>
      </g>
    </svg>
  );
}

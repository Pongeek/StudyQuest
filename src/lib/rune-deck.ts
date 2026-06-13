/**
 * Shared shape + mapper for a topic's Rune Deck as the client sees it.
 * Used by the topic page server component (initial render), the
 * /api/topics/[topicId]/runes route (GET + POST forge), and the card
 * management routes — one DTO so the panel never sees raw row shapes.
 */

/** Manual-add / edit caps — enforced server-side, hinted client-side. */
export const MAX_FRONT_CHARS = 500;
export const MAX_BACK_CHARS = 2000;

export interface RuneSrsDto {
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  reviewCount: number;
  lastRating: number | null;
  lastReviewedAt: string | null;
}

export interface RuneCardDto {
  id: string;
  front: string;
  back: string;
  source: "forged" | "manual";
  editedAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
  /** This user's SM-2 state for the card. Null only if the eager insert
   *  failed — treat as "due now". */
  srs: RuneSrsDto | null;
}

interface RuneCardRow {
  id: string;
  front: string;
  back: string;
  source: string;
  edited_at: string | null;
  suspended_at: string | null;
  created_at: string;
}

interface RuneSrsRow {
  card_id: string;
  due_at: string;
  interval_days: number;
  ease_factor: number;
  review_count: number;
  last_rating: number | null;
  last_reviewed_at: string | null;
}

/** Columns the deck surfaces select from rune_cards. */
export const RUNE_CARD_COLUMNS =
  "id, front, back, source, edited_at, suspended_at, created_at";

/** Columns the deck surfaces select from rune_card_srs. */
export const RUNE_SRS_COLUMNS =
  "card_id, due_at, interval_days, ease_factor, review_count, last_rating, last_reviewed_at";

export function mapRuneCardRows(
  cards: RuneCardRow[],
  srsRows: RuneSrsRow[],
): RuneCardDto[] {
  const srsByCard = new Map(srsRows.map((s) => [s.card_id, s]));
  return cards.map((c) => {
    const srs = srsByCard.get(c.id);
    return {
      id: c.id,
      front: c.front,
      back: c.back,
      source: c.source === "manual" ? "manual" : "forged",
      editedAt: c.edited_at,
      suspendedAt: c.suspended_at,
      createdAt: c.created_at,
      srs: srs
        ? {
            dueAt: srs.due_at,
            intervalDays: Number(srs.interval_days),
            easeFactor: Number(srs.ease_factor),
            reviewCount: srs.review_count,
            lastRating: srs.last_rating,
            lastReviewedAt: srs.last_reviewed_at,
          }
        : null,
    };
  });
}

/**
 * THE client-side due predicate — keep every surface (panel header, per-card
 * badges, future widgets) on this one definition. A card with no SRS row
 * counts as due-now (the seed is fatal server-side, so this is pure defense).
 */
export function isCardDue(card: RuneCardDto, nowMs: number): boolean {
  return (
    !card.suspendedAt &&
    (!card.srs || new Date(card.srs.dueAt).getTime() <= nowMs)
  );
}

/** Locale-free interval label shared by the deck panel and the drill chip:
 *  "due" / "3d" / "2w" / "3mo". */
export function formatIntervalDays(days: number): string {
  if (days <= 0) return "due";
  if (days < 14) return `${Math.max(1, Math.round(days))}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

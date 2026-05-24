/**
 * Per-question answer drafts saved to localStorage so the student's typed
 * text survives mid-flow failures (Claude rate-limit, network blip, page
 * refresh). On a successful grade we clear the draft; on a session
 * complete we clear every draft for that session.
 *
 * Storage shape:
 *   key   `sq:answer-draft:<sessionId>:<questionId>`
 *   value JSON `{ text: string, savedAt: number /* epoch ms *\/ }`
 *
 * Why a tiny wrapper instead of inline localStorage in each engine:
 *   - SSR-safe `typeof window` guard in one place.
 *   - Auto-prune entries older than 30 days on every save so the bucket
 *     doesn't grow unbounded across abandoned sessions.
 *   - One place to bump the namespace if the shape ever changes.
 */

const KEY_PREFIX = "sq:answer-draft:";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface DraftEntry {
  text: string;
  savedAt: number;
}

function buildKey(sessionId: string, questionId: string): string {
  return `${KEY_PREFIX}${sessionId}:${questionId}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Best-effort sweep: walks every key under our namespace once per save
 * call and drops anything older than 30 days. Cheap (handful of keys
 * even for a power user) and keeps the storage bucket bounded.
 */
function pruneStaleDrafts(): void {
  if (!isBrowser()) return;
  const now = Date.now();
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Partial<DraftEntry>;
        if (typeof parsed.savedAt !== "number" || now - parsed.savedAt > MAX_AGE_MS) {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Corrupted entry — toss it.
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Quota exceeded or storage unavailable — silently ignore.
  }
}

export function saveDraft(sessionId: string, questionId: string, text: string): void {
  if (!isBrowser()) return;
  if (!sessionId || !questionId) return;
  // Empty drafts aren't worth persisting — clear instead so the previous
  // draft (if any) doesn't ghost back when the textarea is cleared.
  if (text.trim().length === 0) {
    clearDraft(sessionId, questionId);
    return;
  }
  try {
    pruneStaleDrafts();
    const entry: DraftEntry = { text, savedAt: Date.now() };
    window.localStorage.setItem(buildKey(sessionId, questionId), JSON.stringify(entry));
  } catch {
    // Storage full / disabled — degrade silently. The user still has the
    // textarea contents in memory until they navigate.
  }
}

export function loadDraft(sessionId: string, questionId: string): string | null {
  if (!isBrowser()) return null;
  if (!sessionId || !questionId) return null;
  try {
    const raw = window.localStorage.getItem(buildKey(sessionId, questionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftEntry>;
    if (typeof parsed.text !== "string") return null;
    if (typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(buildKey(sessionId, questionId));
      return null;
    }
    return parsed.text;
  } catch {
    return null;
  }
}

export function clearDraft(sessionId: string, questionId: string): void {
  if (!isBrowser()) return;
  if (!sessionId || !questionId) return;
  try {
    window.localStorage.removeItem(buildKey(sessionId, questionId));
  } catch {
    // Ignore.
  }
}

export function clearSessionDrafts(sessionId: string): void {
  if (!isBrowser()) return;
  if (!sessionId) return;
  const prefix = `${KEY_PREFIX}${sessionId}:`;
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore.
  }
}

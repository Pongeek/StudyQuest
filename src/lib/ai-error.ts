/**
 * Classifies a thrown error from any user-triggered AI call (grading,
 * scroll generation, debrief, etc.) into actionable, voice-consistent
 * copy shown directly to the student.
 *
 * Different from `episode-error.ts` — that one runs server-side ONLY,
 * inside the long-running episode extractor, and its messages assume
 * the user is going to fix a PDF. This classifier covers the live
 * grading + content surfaces where the user is mid-flow.
 *
 * Used by:
 *   - The 4 answer API routes (quiz / exam / boss-fight / review) to
 *     surface why grading failed without throwing away the typed answer
 *   - Client-side fetch wrappers to catch NETWORK errors (offline /
 *     dropped connection) and treat them the same way
 */

export type AiErrorCode =
  | "RATE_LIMITED"
  | "BUDGET_CAP"
  | "OVERLOADED"
  | "AUTH_ERROR"
  | "TIMEOUT"
  | "NETWORK"
  // Question was soft-replaced by the regenerate flow between page load
  // and answer submission. Not really an "AI error" — but uses the same
  // classified-error envelope so the existing answer-engine catch path
  // surfaces it as a useful toast instead of "AI broken, try again."
  | "QUESTION_RETIRED"
  | "UNKNOWN";

export interface ClassifiedAiError {
  code: AiErrorCode;
  /** Short, plain-language sentence shown to the student. Loremaster voice
   *  — no "Sorry", no "Please". Ends with a period. */
  userMessage: string;
  /** True when re-submitting the same answer is likely to succeed shortly
   *  (rate-limit, overload, network blip). False for config issues. */
  retryable: boolean;
}

// Word-boundary regex builders for HTTP status codes so we don't match
// random digits in error text like "after 4014 bytes" or "request id 12401".
// `\b` doesn't recognize a leading digit boundary in JS regex (digits ARE
// word chars), so we anchor on non-digit / start-of-string / end-of-string.
const STATUS_RE = (code: number) =>
  new RegExp(`(^|[^0-9])${code}([^0-9]|$)`);

export function classifyAiError(err: unknown): ClassifiedAiError {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();
  // Also peek at .status from Anthropic SDK errors — more reliable than
  // string matching. SDK throws `APIError` subclasses with a `.status`
  // numeric property and a `.message` field.
  const status: number | undefined =
    typeof err === "object" && err !== null && "status" in err
      ? (err as { status?: number }).status
      : undefined;

  // Anthropic 429 — rate limited. Almost always recoverable in <60s.
  if (
    status === 429 ||
    STATUS_RE(429).test(msg) ||
    msg.includes("rate_limit") ||
    msg.includes("rate limit")
  ) {
    return {
      code: "RATE_LIMITED",
      userMessage:
        "The AI is catching its breath. Wait a few seconds, then submit again — your answer is saved.",
      retryable: true,
    };
  }

  // Anthropic 529 / overloaded_error — server-side capacity issue.
  if (
    status === 529 ||
    STATUS_RE(529).test(msg) ||
    msg.includes("overloaded_error") ||
    msg.includes("overloaded")
  ) {
    return {
      code: "OVERLOADED",
      userMessage:
        "The AI is under heavy load right now. Wait about a minute, then submit again — your answer is saved.",
      retryable: true,
    };
  }

  // Anthropic billing / spending cap hit. Manual operator fix required.
  if (
    msg.includes("billing") ||
    msg.includes("credit_balance") ||
    msg.includes("spending limit") ||
    msg.includes("quota") ||
    msg.includes("insufficient_quota")
  ) {
    return {
      code: "BUDGET_CAP",
      userMessage:
        "The AI service hit its monthly budget. Your answer is saved — message the admin to refill.",
      retryable: false,
    };
  }

  // Misconfigured key — deploy / env issue, not the user's fault.
  if (
    status === 401 ||
    STATUS_RE(401).test(msg) ||
    msg.includes("invalid api key") ||
    msg.includes("unauthorized") ||
    msg.includes("claude_api_key is not set")
  ) {
    return {
      code: "AUTH_ERROR",
      userMessage:
        "Server configuration issue — the AI service couldn't authenticate. Your answer is saved.",
      retryable: false,
    };
  }

  // Vercel function timeout (60s on the answer routes).
  if (
    status === 504 ||
    STATUS_RE(504).test(msg) ||
    msg.includes("timeout") ||
    msg.includes("function timed out")
  ) {
    return {
      code: "TIMEOUT",
      userMessage:
        "The grading call took too long. Try submitting again with a shorter answer — your text is saved.",
      retryable: true,
    };
  }

  // Client-side network drop (offline, DNS, fetch failed).
  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("err_internet_disconnected") ||
    msg.includes("load failed")
  ) {
    return {
      code: "NETWORK",
      userMessage:
        "Lost the connection mid-submit. Check your internet, then try again — your answer is saved.",
      retryable: true,
    };
  }

  // Catch-all — generic but still actionable.
  return {
    code: "UNKNOWN",
    userMessage:
      "Something went wrong while grading. Try submitting again — your answer is saved.",
    retryable: true,
  };
}

/**
 * Build a `{ error: ClassifiedAiError }` body for routes to return. Use
 * this for EVERY user-facing error response from a route whose client
 * uses `readClassifiedErrorFromResponse` — the helper only recognizes
 * the object-shape envelope, so plain `{ error: "string" }` responses
 * fall through to UNKNOWN with misleading "AI broken, retry" copy.
 *
 * Lives outside the route files so the shape stays consistent and the
 * type is enforced at the call site.
 */
export function classifiedErrorBody(
  code: AiErrorCode,
  userMessage: string,
  retryable = false,
): { error: ClassifiedAiError } {
  return { error: { code, userMessage, retryable } };
}

/**
 * Helper for client engines: extract a user-facing message from a fetch
 * Response that returned a non-ok status. Falls back to the classifier
 * when the body doesn't carry a structured error.
 */
export async function readClassifiedErrorFromResponse(
  res: Response
): Promise<ClassifiedAiError> {
  try {
    const body = await res.json();
    if (
      body &&
      typeof body === "object" &&
      body.error &&
      typeof body.error === "object" &&
      typeof body.error.userMessage === "string"
    ) {
      return body.error as ClassifiedAiError;
    }
    // Body had no structured error — synthesize from status + any text.
    return classifyAiError(new Error(`${res.status} ${body?.detail ?? res.statusText ?? ""}`));
  } catch {
    return classifyAiError(new Error(`${res.status} ${res.statusText ?? ""}`));
  }
}

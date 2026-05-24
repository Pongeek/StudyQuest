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

export function classifyAiError(err: unknown): ClassifiedAiError {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();

  // Anthropic 429 — rate limited. Almost always recoverable in <60s.
  if (msg.includes("429") || msg.includes("rate_limit") || msg.includes("rate limit")) {
    return {
      code: "RATE_LIMITED",
      userMessage:
        "The AI is catching its breath. Wait a few seconds, then submit again — your answer is saved.",
      retryable: true,
    };
  }

  // Anthropic 529 / overloaded_error — server-side capacity issue.
  if (
    msg.includes("529") ||
    msg.includes("overloaded") ||
    msg.includes("overloaded_error")
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
    msg.includes("401") ||
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
  if (msg.includes("timeout") || msg.includes("function timed out") || msg.includes("504")) {
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

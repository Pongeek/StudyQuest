import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Hebrew/Arabic detection for dir="rtl" decisions. The same Unicode-range
 * test is inlined across many engines/pages — new code should call this
 * instead of re-typing the regex (copies have already drifted once).
 */
export function isRTLText(text: string | null | undefined): boolean {
  return /[֐-׿؀-ۿ]/.test(text || "");
}

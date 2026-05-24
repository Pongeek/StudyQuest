"use client";

import { useRouter } from "next/navigation";
import RegenerateQuestionButton from "@/components/quiz/RegenerateQuestionButton";

/**
 * Thin client wrapper around the shared RegenerateQuestionButton for the
 * TopicMasteryPanel Stumbles list. On a successful regenerate, refreshes
 * the server component so the just-replaced stumble disappears from the
 * heatmap (the panel filters out questions with `replaced_at IS NOT NULL`).
 *
 * Separated from TopicMasteryPanel because that file is a server component
 * — router + onRegenerated need a client island.
 */
export default function StumbleRegenerateButton({
  questionId,
}: {
  questionId: string;
}) {
  const router = useRouter();
  return (
    <RegenerateQuestionButton
      questionId={questionId}
      variant="label"
      onRegenerated={() => {
        // Refresh the topic detail page so the Stumbles list re-queries
        // and drops the now-soft-replaced question.
        router.refresh();
      }}
    />
  );
}

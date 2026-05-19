"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Swords, RefreshCw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StartQuizButtonProps {
  topicId: string;
  courseId: string;
  hasExistingQuestions: boolean;
}

export default function StartQuizButton({
  topicId,
  courseId,
  hasExistingQuestions,
}: StartQuizButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"same" | "new" | null>(null);

  const startQuiz = async (regenerate: boolean) => {
    setIsLoading(true);
    setLoadingAction(regenerate ? "new" : "same");
    try {
      if (!hasExistingQuestions || regenerate) {
        toast.info(
          regenerate
            ? "Generating fresh questions for you..."
            : "Generating questions for this topic..."
        );
        const genRes = await fetch(`/api/topics/${topicId}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regenerate }),
        });
        if (!genRes.ok) throw new Error("Failed to generate questions");
      }

      const sessionRes = await fetch("/api/quiz/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      });
      if (!sessionRes.ok) throw new Error("Failed to start quiz session");

      const { sessionId } = await sessionRes.json();
      router.push(
        `/dashboard/courses/${courseId}/topics/${topicId}/quiz/${sessionId}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleClick = () => {
    if (!hasExistingQuestions) {
      // First time — generate and start directly
      startQuiz(false);
    } else {
      // Has existing questions — show options
      setShowOptions(true);
    }
  };

  // Show the choice between same/new questions
  if (showOptions && hasExistingQuestions) {
    return (
      <div className="space-y-3 w-full max-w-sm mx-auto">
        <p className="text-sm text-slate-400 text-center mb-4">
          You already have questions for this topic.
        </p>

        <Button
          size="lg"
          onClick={() => startQuiz(false)}
          disabled={isLoading}
          className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-5 text-sm gap-2 transition-all duration-150"
        >
          {loadingAction === "same" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Practice Same Questions
            </>
          )}
        </Button>

        <Button
          size="lg"
          onClick={() => startQuiz(true)}
          disabled={isLoading}
          variant="outline"
          className="w-full border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/50 py-5 text-sm gap-2 transition-all duration-300"
        >
          {loadingAction === "new" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating new questions...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Generate New Questions
            </>
          )}
        </Button>

        <button
          onClick={() => setShowOptions(false)}
          disabled={isLoading}
          className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <Button
      size="lg"
      onClick={handleClick}
      disabled={isLoading}
      className="bg-indigo-500 hover:bg-indigo-400 text-white font-medium px-10 py-6 text-base gap-2 transition-all duration-150"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Preparing your quest...
        </>
      ) : (
        <>
          <Swords className="w-5 h-5" />
          Start Quiz
        </>
      )}
    </Button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, RefreshCw, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BossPrepActionsProps {
  episodeId: string;
  courseId: string;
  hasExistingQuestions: boolean;
}

export default function BossPrepActions({
  episodeId,
  courseId,
  hasExistingQuestions,
}: BossPrepActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"same" | "new" | null>(null);

  const startFight = async (regenerate: boolean) => {
    setIsLoading(true);
    setLoadingAction(regenerate ? "new" : "same");

    if (regenerate) {
      toast.info("Generating fresh questions… this takes ~60–120s.");
    } else if (!hasExistingQuestions) {
      toast.info("First time — generating questions takes ~60–120s.");
    }

    try {
      const res = await fetch("/api/boss-fight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId, courseId, regenerate }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start boss fight");
      }

      const { sessionId } = await res.json();
      router.push(`/dashboard/courses/${courseId}/boss/${sessionId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  if (hasExistingQuestions) {
    return (
      <div className="space-y-3 w-full">
        {/* Practice Same Questions */}
        <Button
          size="lg"
          onClick={() => startFight(false)}
          disabled={isLoading}
          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-5 text-sm gap-2 transition-all duration-150"
        >
          {loadingAction === "same" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting fight…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Practice Same Questions
            </>
          )}
        </Button>

        {/* Generate New Questions */}
        <Button
          size="lg"
          onClick={() => startFight(true)}
          disabled={isLoading}
          variant="outline"
          className="w-full border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/60 py-5 text-sm gap-2 transition-all duration-200 bg-transparent"
        >
          {loadingAction === "new" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating new questions…
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Generate New Questions
            </>
          )}
        </Button>
      </div>
    );
  }

  // No existing questions — single "Engage Boss" button
  return (
    <div className="space-y-3 w-full">
      <Button
        size="lg"
        onClick={() => startFight(false)}
        disabled={isLoading}
        className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-5 text-sm gap-2 transition-all duration-150"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Summoning Boss…
          </>
        ) : (
          <>
            <Skull className="w-4 h-4" />
            Engage Boss
          </>
        )}
      </Button>
      <p className="text-xs text-slate-500 text-center italic">
        First time — generating questions takes ~60–120s.
      </p>
    </div>
  );
}

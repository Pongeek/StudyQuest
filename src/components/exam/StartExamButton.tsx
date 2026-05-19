"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface StartExamButtonProps {
  sourceFileId: string;
  courseId: string;
  mode: "timed" | "assisted";
  label: string;
  icon: "clock" | "book";
}

export default function StartExamButton({
  sourceFileId,
  courseId,
  mode,
  label,
  icon,
}: StartExamButtonProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceFileId, mode }),
      });

      if (!res.ok) throw new Error("Failed to start exam session");
      const { sessionId } = await res.json();

      router.push(`/dashboard/courses/${courseId}/exam/${sessionId}`);
    } catch {
      toast.error("Failed to start exam session.");
      setIsStarting(false);
    }
  };

  const Icon = icon === "clock" ? Clock : BookOpen;

  return (
    <Button
      onClick={handleStart}
      disabled={isStarting}
      variant={mode === "timed" ? "outline" : "default"}
      className={
        mode === "timed"
          ? "flex-1 border-white/[0.08] text-slate-300 hover:bg-white/[0.04] hover:text-white gap-2 transition-colors duration-150"
          : "flex-1 bg-indigo-500 hover:bg-indigo-400 text-white font-medium gap-2 transition-colors duration-150"
      }
    >
      {isStarting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      {label}
    </Button>
  );
}

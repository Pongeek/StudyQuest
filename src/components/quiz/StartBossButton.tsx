"use client";

import { useRouter } from "next/navigation";
import { Skull } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StartBossButtonProps {
  episodeId: string;
  courseId: string;
}

export default function StartBossButton({
  episodeId,
  courseId,
}: StartBossButtonProps) {
  const router = useRouter();

  return (
    <Button
      onClick={() =>
        router.push(`/dashboard/courses/${courseId}/boss/prep/${episodeId}`)
      }
      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium gap-2 transition-all duration-150"
    >
      <Skull className="w-4 h-4" />
      Challenge Boss
    </Button>
  );
}

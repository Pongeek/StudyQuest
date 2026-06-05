"use client";

// ─── FeatureTrophyButton ──────────────────────────────────────────────────────
// Pins (or unpins) an earned trophy as the profile's Featured Trophy — the one
// shown on the hero crest. Toggling sends the achievement id (or null to clear,
// which falls back to most-recently-earned). Refreshes the server page on
// success so the crest + the star state re-render.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  achievementId: string;
  isFeatured: boolean;
}

export default function FeatureTrophyButton({ achievementId, isFeatured }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/users/featured-trophy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ achievementId: isFeatured ? null : achievementId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={isFeatured}
      aria-label={isFeatured ? "Unpin this trophy from your crest" : "Feature this trophy on your crest"}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors pixel-focus disabled:opacity-50",
        isFeatured ? "text-amber-300" : "text-slate-500 hover:text-amber-300"
      )}
    >
      <Star className={cn("w-3 h-3", isFeatured && "fill-amber-400")} />
      {isFeatured ? "Featured" : "Feature"}
    </button>
  );
}

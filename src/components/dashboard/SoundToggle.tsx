"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSound } from "@/lib/useSound";
import { cn } from "@/lib/utils";

/**
 * Compact icon-only mute toggle for the dashboard nav.
 *
 * - Persisted to localStorage via the underlying `useSound` engine
 * - Plays a quick "correct" ping on un-mute so the user knows sound works
 * - Matches the existing nav HUD chip aesthetic
 */
export default function SoundToggle() {
  const { muted, toggleMuted, play } = useSound();

  const handleClick = () => {
    const wasMuted = muted;
    toggleMuted();
    // If un-muting, fire a small confirmation ping so the user hears it works.
    // Use setTimeout(0) so the mute state has flipped before the sound plays.
    if (wasMuted) {
      setTimeout(() => play("correct"), 0);
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={muted ? "Enable sound effects" : "Mute sound effects"}
      aria-pressed={!muted}
      className={cn(
        "p-1.5 rounded transition-colors duration-150 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400",
        muted ? "text-slate-600" : "text-slate-300"
      )}
      title={muted ? "Sound: OFF" : "Sound: ON"}
    >
      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );
}

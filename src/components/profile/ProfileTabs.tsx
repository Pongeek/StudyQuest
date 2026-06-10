"use client";

// ─── ProfileTabs ──────────────────────────────────────────────────────────────
// Client island that tames the profile's long scroll into three sections:
// Overview · Journey · Trophy Case. The hero/identity card is rendered ABOVE
// this island (in the server page), so the learner's character is always
// visible regardless of the active tab.
//
// Built on the Base UI tabs primitive (accessible roving-tabindex + aria) but
// styled in the pixel-RPG vocabulary rather than the default shadcn chrome.
// Section bodies are passed in as already-rendered server nodes — the page
// stays a Server Component; only the tab chrome is client.

import { Tabs } from "@base-ui/react/tabs";
import { LayoutDashboard, Trophy, Map } from "lucide-react";
import { cn } from "@/lib/utils";

// Overview leads — it's the default landing tab, so it also sits leftmost.
// (Overview = the learner's numbers at a glance; Journey = the quest narrative.)
const TAB_DEFS = [
  { value: "overview", label: "OVERVIEW", Icon: LayoutDashboard },
  { value: "journey", label: "JOURNEY", Icon: Map },
  { value: "trophies", label: "TROPHY CASE", Icon: Trophy },
] as const;

interface Props {
  overview: React.ReactNode;
  trophyCase: React.ReactNode;
  journey: React.ReactNode;
}

export default function ProfileTabs({ overview, trophyCase, journey }: Props) {
  return (
    <Tabs.Root defaultValue="overview" className="space-y-6">
      <Tabs.List
        aria-label="Profile sections"
        className="relative grid grid-cols-3 gap-1 border-b border-white/[0.06]"
      >
        {TAB_DEFS.map(({ value, label, Icon }) => (
          <Tabs.Tab
            key={value}
            value={value}
            className={cn(
              "group relative flex items-center justify-center gap-1.5 sm:gap-2",
              "min-h-[44px] px-1.5 py-2 cursor-pointer select-none outline-none",
              "font-pixel text-[8px] sm:text-[10px] tracking-wider transition-colors",
              "text-slate-500 hover:text-slate-300 data-[active]:text-indigo-300",
              "focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            )}
          >
            {/* Active fill + bottom accent — the only chrome, RPG-flavored. */}
            <span
              aria-hidden
              className="absolute inset-0 bg-indigo-500/10 opacity-0 transition-opacity group-data-[active]:opacity-100"
            />
            <span
              aria-hidden
              className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-400 origin-center scale-x-0 transition-transform group-data-[active]:scale-x-100"
            />
            <Icon className="relative w-3.5 h-3.5 shrink-0" />
            <span className="relative">{label}</span>
          </Tabs.Tab>
        ))}
      </Tabs.List>

      <Tabs.Panel value="overview" className="outline-none motion-safe:animate-slide-up">
        {overview}
      </Tabs.Panel>
      <Tabs.Panel value="trophies" className="outline-none motion-safe:animate-slide-up">
        {trophyCase}
      </Tabs.Panel>
      <Tabs.Panel value="journey" className="outline-none motion-safe:animate-slide-up">
        {journey}
      </Tabs.Panel>
    </Tabs.Root>
  );
}

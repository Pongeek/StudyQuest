"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, User, Menu, X, Flame, Zap, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateLevel, xpProgressInCurrentLevel } from "@/lib/xp";
import { AnimatedStudyQuestMark } from "@/components/brand/StudyQuestLogo";
import SoundToggle from "@/components/dashboard/SoundToggle";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

interface DashboardNavProps {
  totalXp: number;
  streak: number;
}

export default function DashboardNav({ totalXp, streak }: DashboardNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const level = calculateLevel(totalXp);
  const { percentage } = xpProgressInCurrentLevel(totalXp);
  const isHotStreak = streak >= 7;

  // Pad numbers like "07" / "1,234" — feels more arcade-HUD than "7" or "1234".
  const levelLabel = `LV.${String(level).padStart(2, "0")}`;
  const xpLabel = totalXp.toLocaleString();

  return (
    <header className="bg-slate-950/90 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between max-w-6xl">
        {/* Left: Brand + nav links */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <AnimatedStudyQuestMark className="w-10 h-10" />
            <span className="hidden sm:inline font-pixel text-[13px] text-white tracking-tight">
              STUDY<span className="text-amber-400">QUEST</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors duration-150",
                    // Pixel-style tab — square corners, no rounded pill.
                    active
                      ? "text-indigo-300"
                      : "text-slate-400 hover:text-white",
                  )}
                >
                  <Icon className={cn("w-4 h-4", active && "text-indigo-400")} />
                  {label}
                  {/* Chunky 2-pixel underline on the active link — reads as a
                      pressed-down arcade tab. */}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-indigo-400"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: HUD chips + user */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Level chip with XP ring — pixel-bordered HUD module */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="pixel-chip text-indigo-400 bg-indigo-500/10">
              {/* Mini mastery ring */}
              <div className="relative w-6 h-6 flex-shrink-0">
                <svg width="24" height="24" className="absolute inset-0 -rotate-90">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(99,102,241,0.25)" strokeWidth="3" />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="3"
                    strokeLinecap="butt"
                    strokeDasharray={`${2 * Math.PI * 9}`}
                    strokeDashoffset={`${2 * Math.PI * 9 * (1 - percentage / 100)}`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Shield className="w-3 h-3 text-indigo-300" />
                </div>
              </div>
              <span className="font-pixel text-[10px] text-white tabular-nums">
                {levelLabel}
              </span>
            </div>

            {/* XP chip */}
            <div className="pixel-chip text-amber-400 bg-amber-500/10">
              <Zap className="w-3 h-3 text-amber-300" />
              <span className="font-pixel text-[10px] text-amber-300 tabular-nums">
                {xpLabel}
              </span>
            </div>
          </div>

          {/* Streak chip */}
          <div
            className={cn(
              "pixel-chip transition-colors duration-300",
              isHotStreak
                ? "text-orange-400 bg-orange-500/10"
                : "text-slate-600 bg-slate-800/40",
            )}
          >
            <Flame className={cn("w-3 h-3", isHotStreak ? "text-orange-300" : "text-slate-500")} />
            <span
              className={cn(
                "font-pixel text-[10px] tabular-nums",
                isHotStreak ? "text-orange-300" : "text-slate-400",
              )}
            >
              {streak}
            </span>
          </div>

          <div className="w-px h-6 bg-slate-700/50 hidden sm:block" />

          <SoundToggle />

          <UserButton />

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="md:hidden text-slate-400 hover:text-white p-1.5 hover:bg-white/5 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t-2 border-indigo-500/30 px-4 py-3 space-y-1 bg-slate-950/95 backdrop-blur-xl">
          {/* Mobile stats row */}
          <div className="flex items-center gap-2 mb-3 pb-3 border-b-2 border-slate-800/60 sm:hidden">
            <div className="pixel-chip text-indigo-400 bg-indigo-500/10">
              <Shield className="w-3 h-3 text-indigo-300" />
              <span className="font-pixel text-[10px] text-white">{levelLabel}</span>
            </div>
            <div className="pixel-chip text-amber-400 bg-amber-500/10">
              <Zap className="w-3 h-3 text-amber-300" />
              <span className="font-pixel text-[10px] text-amber-300 tabular-nums">
                {xpLabel}
              </span>
            </div>
          </div>

          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-500/15 text-indigo-300 border-l-4 border-indigo-400"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent",
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}

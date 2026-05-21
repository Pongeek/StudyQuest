import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatedStudyQuestMark } from "@/components/brand/StudyQuestLogo";
import LandingHero from "@/components/landing/LandingHero";
import LandingFeatures from "@/components/landing/LandingFeatures";
import LandingQuizDemo from "@/components/landing/LandingQuizDemo";
import LandingProductMockups from "@/components/landing/LandingProductMockups";
import LandingStory from "@/components/landing/LandingStory";
import LandingComparison from "@/components/landing/LandingComparison";
import LandingCTA from "@/components/landing/LandingCTA";
import LandingQuestPath from "@/components/landing/LandingQuestPath";
import SmoothScroll from "@/components/landing/SmoothScroll";
import AuroraBackground from "@/components/effects/AuroraBackground";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-clip">
      {/* Smooth-scroll engine (Lenis) — landing page scope only */}
      <SmoothScroll />

      {/* Side-rail quest path — draws itself as user scrolls */}
      <LandingQuestPath />

      {/* ── Ambient atmosphere — pixel grid + CRT scanlines + aurora orbs.
            Layer order matches dashboard/layout.tsx for a unified look. */}
      <div className="fixed inset-0 pixel-grid opacity-70 pointer-events-none" />
      <div className="fixed inset-0 pixel-scanlines opacity-60 pointer-events-none" />
      <div className="fixed inset-0 pixel-vignette pointer-events-none" />
      <AuroraBackground />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <AnimatedStudyQuestMark className="w-10 h-10" />
            <span className="font-pixel text-[13px] tracking-tight">
              STUDY<span className="text-amber-400">QUEST</span>
            </span>
          </Link>
          <div className="flex gap-3 items-center">
            <Link href="/sign-in">
              <Button
                variant="ghost"
                className="font-pixel text-[10px] tracking-tight text-slate-400 hover:text-white hover:bg-white/5 rounded-none"
              >
                SIGN IN
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button
                className={cn(
                  "pixel-chip text-amber-400 bg-amber-500/15 hover:bg-amber-500/25",
                  "font-pixel text-[10px] text-amber-200 hover:text-amber-100",
                  "px-4 py-2 transition-colors duration-150",
                )}
              >
                START QUEST
              </Button>
            </Link>
          </div>
        </nav>

        <LandingHero />
        <LandingFeatures />
        <LandingQuizDemo />
        <LandingProductMockups />
        <LandingStory />
        <LandingComparison />
        <LandingCTA />

        <footer className="container mx-auto px-6 py-8 text-center border-t-2 border-slate-800/50">
          <span className="font-pixel text-[10px] text-slate-600 tracking-tight">
            STUDYQUEST &copy; {new Date().getFullYear()} · TURN STUDYING INTO AN ADVENTURE
          </span>
        </footer>
      </div>
    </div>
  );
}

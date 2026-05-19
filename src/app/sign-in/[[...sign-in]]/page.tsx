import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { AnimatedStudyQuestMark } from "@/components/brand/StudyQuestLogo";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Pixel ambient — matches the layouts so the auth screens don't feel
          like a separate product. */}
      <div className="absolute inset-0 pixel-grid opacity-50 pointer-events-none" />
      <div className="absolute inset-0 pixel-scanlines opacity-60 pointer-events-none" />
      <div className="absolute inset-0 pixel-vignette pointer-events-none" />

      <Link
        href="/"
        className="relative flex flex-col items-center gap-4 mb-10 group"
        aria-label="StudyQuest home"
      >
        <AnimatedStudyQuestMark className="w-20 h-20 transition-transform duration-300 group-hover:scale-105" />
        <span className="font-pixel text-[14px] text-white tracking-tight">
          STUDY<span className="text-amber-400">QUEST</span>
        </span>
        <span className="font-pixel text-[8px] text-slate-500 tracking-[0.2em] -mt-1">
          PRESS START TO PLAY
        </span>
      </Link>
      <div className="relative">
        <SignIn forceRedirectUrl="/dashboard" />
      </div>
    </div>
  );
}

"use client";

// ─── LandingFooter ───────────────────────────────────────────────────────────
// Multi-column footer for the landing page. Keeps the pixel vocabulary
// (nail corners, font-pixel section labels, indigo top accent line, chunky
// pixel-shadow CTA on hover) so the page closes the same way it opens.

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sword, Code2, Mail, Heart } from "lucide-react";
import { AnimatedStudyQuestMark } from "@/components/brand/StudyQuestLogo";

const QUICK_LINKS: Array<{ label: string; href: string }> = [
  { label: "SIGN IN", href: "/sign-in" },
  { label: "START QUEST", href: "/sign-up" },
  { label: "DASHBOARD", href: "/dashboard" },
];

const COMPANION_LINKS: Array<{ label: string; href: string; icon?: React.ReactNode }> = [
  { label: "GITHUB", href: "https://github.com/Pongeek/StudyQuest", icon: <Code2 className="w-3 h-3" /> },
  { label: "CONTACT", href: "mailto:maximpim95@gmail.com", icon: <Mail className="w-3 h-3" /> },
];

export default function LandingFooter() {
  const reduceMotion = useReducedMotion();
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-20">
      {/* Top accent line — matches section accent vocabulary */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

      <div className="container mx-auto px-6 py-14">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20% 0px -20% 0px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12 max-w-5xl mx-auto"
        >
          {/* ── Brand cluster ── */}
          <div className="md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3 mb-4 group">
              <AnimatedStudyQuestMark className="w-9 h-9" />
              <span className="font-pixel text-[13px] tracking-tight text-white">
                STUDY<span className="text-amber-400">QUEST</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed mb-5 max-w-xs">
              Turn studying into an adventure. Earn XP, level up, master any subject.
            </p>

            {/* Mini CTA back to sign-up */}
            <Link
              href="/sign-up"
              className="inline-block pixel-focus outline-none transition-transform duration-100 hover:translate-y-0.5 active:translate-y-1"
            >
              <div className="px-4 py-2.5 inline-flex items-center gap-2 font-pixel text-[9px] tracking-wider bg-indigo-500 text-white shadow-[0_3px_0_0_#312e81] hover:shadow-[0_1px_0_0_#312e81] active:shadow-[0_0_0_0_#312e81]">
                <Sword className="w-3.5 h-3.5" aria-hidden />
                START YOUR QUEST
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </div>
            </Link>
          </div>

          {/* ── Quick links ── */}
          <div>
            <div className="font-pixel text-[9px] tracking-wider text-amber-400/90 mb-4 flex items-center gap-2">
              <span aria-hidden className="inline-block w-2 h-2 bg-amber-400" />
              QUICK LINKS
            </div>
            <ul className="space-y-2.5">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-pixel text-[10px] tracking-wider text-slate-400 hover:text-white transition-colors duration-150 inline-flex items-center gap-1.5 group"
                  >
                    <span aria-hidden className="opacity-0 group-hover:opacity-100 text-amber-400 transition-opacity">
                      &#9670;
                    </span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Companion / contact ── */}
          <div>
            <div className="font-pixel text-[9px] tracking-wider text-indigo-400/90 mb-4 flex items-center gap-2">
              <span aria-hidden className="inline-block w-2 h-2 bg-indigo-400" />
              COMPANION
            </div>
            <ul className="space-y-2.5 mb-5">
              {COMPANION_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="font-pixel text-[10px] tracking-wider text-slate-400 hover:text-white transition-colors duration-150 inline-flex items-center gap-2 group"
                  >
                    <span className="inline-flex items-center justify-center w-6 h-6 pixel-border bg-slate-900/60 text-slate-400 group-hover:text-indigo-300 transition-colors">
                      {link.icon}
                    </span>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-600 leading-relaxed max-w-[18ch]">
              Built solo as a study companion. Bugs welcome.
            </p>
          </div>
        </motion.div>

        {/* ── Bottom strip ── */}
        <div className="mt-12 pt-6 border-t border-slate-800/60 max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-pixel text-[9px] tracking-wider text-slate-600">
            STUDYQUEST &copy; {year} &middot; TURN STUDYING INTO AN ADVENTURE
          </span>
          <span className="font-pixel text-[9px] tracking-wider text-slate-700 inline-flex items-center gap-1.5">
            MADE WITH
            <Heart aria-hidden className="w-3 h-3 text-amber-500/80 fill-amber-500/80" />
            FOR LEARNERS
          </span>
        </div>
      </div>
    </footer>
  );
}

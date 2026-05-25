"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import TierLevelFrame from "@/components/gamification/TierLevelFrame";
import { getLevelTierVisuals } from "@/lib/level-tier";

/**
 * Landing-only "Tier Progression" mini-strip — a horizontal row of all
 * six rank badges so the viewer sees the full Novice → Sage arc before
 * the feature grid. Sits between the hero (showing one cycling badge)
 * and "Equip your kit" (the feature trios), reinforcing the level
 * system as the spine of the product.
 *
 * Each badge stagger-lifts in as the section enters the viewport, and
 * each card lifts subtly on hover so the row feels alive. Tier names
 * sit under each badge — the silhouette + accent color is the primary
 * signal, the title is the secondary cue.
 */
const TIER_SAMPLES = [
  { level: 1,  caption: "The path begins"   },
  { level: 7,  caption: "Sparks of progress" },
  { level: 14, caption: "Steady wisdom"     },
  { level: 27, caption: "Crown of mastery"  },
  { level: 42, caption: "Epic ascendant"    },
  { level: 52, caption: "Mythic endgame"    },
];

export default function LandingTierStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-30% 0px -30% 0px" });

  return (
    <section
      ref={ref}
      aria-labelledby="landing-tier-strip-heading"
      className="container mx-auto px-6 py-16 sm:py-20"
    >
      <div className="text-center mb-10 sm:mb-12">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="font-pixel text-[9px] tracking-wider text-amber-400/90 mb-3"
        >
          RANK PROGRESSION
        </motion.p>
        <motion.h2
          id="landing-tier-strip-heading"
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight"
        >
          Six tiers. One academic journey.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed"
        >
          Every level you climb changes how your rank looks. From a plain
          slate frame at <span className="text-slate-300 font-medium">Novice</span> to
          a rotating rune ring around your <span className="text-pink-300 font-medium">Sage</span> badge,
          progression is something you wear, not just a number.
        </motion.p>
      </div>

      {/* The 6-tier row — 2 cols on mobile, 3 on sm, full 6 on lg */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5 sm:gap-6 max-w-5xl mx-auto">
        {TIER_SAMPLES.map((sample, i) => {
          const visuals = getLevelTierVisuals(sample.level);
          return (
            <motion.div
              key={sample.level}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.5,
                delay: 0.3 + i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex flex-col items-center text-center gap-3 group"
            >
              {/* The badge itself — lifts subtly on hover. Decorations
                  (sparks, laurels, crown, flames, rune ring) lift with
                  it because they're rendered INSIDE the frame element. */}
              <div className="transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-[1.04]">
                <TierLevelFrame level={sample.level} />
              </div>

              {/* Tier title in pixel font + small caption underneath */}
              <div className="space-y-1">
                <p className="font-pixel text-[10px] tracking-widest text-white">
                  {visuals.tierTitle.toUpperCase()}
                </p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {sample.caption}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

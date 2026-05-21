"use client";

import Link from "next/link";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { ArrowRight, Sword } from "lucide-react";

// Small radial burst using JSX-based motion divs (no canvas)
const PARTICLE_COUNT = 12;

function ParticleBurst({ active }: { active: boolean }) {
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (i / PARTICLE_COUNT) * 2 * Math.PI;
    const dist = 55 + Math.random() * 25;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    const size = 3 + Math.random() * 3;
    const colors = ["bg-indigo-400", "bg-violet-400", "bg-amber-400", "bg-indigo-300"];
    const color = colors[i % colors.length];
    return { x, y, size, color };
  });

  return (
    <AnimatePresence>
      {active && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          {particles.map(({ x, y, size, color }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{ opacity: 0, x, y, scale: 0.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className={`absolute rounded-full ${color}`}
              style={{ width: size, height: size }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

export default function LandingCTA() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const [hovering, setHovering] = useState(false);
  const [burst, setBurst] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    setHovering(true);
    hoverTimer.current = setTimeout(() => {
      setBurst(true);
      setTimeout(() => setBurst(false), 600);
    }, 200);
  };

  const handleMouseLeave = () => {
    setHovering(false);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  return (
    <section className="container mx-auto px-6 py-20 text-center" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="relative pixel-border text-amber-500/80 p-12 sm:p-16 max-w-2xl mx-auto bg-slate-900/95 transition-shadow duration-300 ease-out hover:shadow-[0_24px_60px_-18px_rgba(245,158,11,0.5)]"
      >
        {/* Pixel nail corners — amber, marks final CTA as featured */}
        <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
        <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
        <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
        <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />

        <div className="relative z-[1]">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15 }}
            className="font-pixel text-[9px] tracking-wider text-amber-400/90 mb-3"
          >
            READY TO BEGIN
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-4xl font-bold mb-4 text-white tracking-tight"
          >
            Your adventure awaits
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.3 }}
            className="text-slate-400 mb-8"
          >
            Free to start. Upload your first course in minutes.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4 }}
            className="relative inline-flex"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <ParticleBurst active={burst} />
            <Link
              href="/sign-up"
              className="pixel-focus outline-none transition-transform duration-100 hover:translate-y-0.5 active:translate-y-1"
            >
              <div className="px-7 py-4 flex items-center justify-center gap-2 font-pixel text-[11px] tracking-wider bg-amber-500 text-slate-950 shadow-[0_4px_0_0_#78350f] hover:shadow-[0_2px_0_0_#78350f] active:shadow-[0_0_0_0_#78350f]">
                <Sword className="w-4 h-4" aria-hidden />
                START FOR FREE
                <ArrowRight className="w-4 h-4" aria-hidden />
              </div>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

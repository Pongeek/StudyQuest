"use client";

import Link from "next/link";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        className="relative rounded-2xl p-12 sm:p-16 max-w-2xl mx-auto overflow-hidden border border-white/[0.07] bg-white/[0.03]"
      >
        <div className="relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-4xl font-bold mb-4 text-white tracking-tight"
          >
            Ready to Begin?
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
            <Link href="/sign-up">
              <Button
                size="lg"
                className="bg-indigo-500 hover:bg-indigo-400 text-white font-medium text-lg px-10 py-7 transition-colors duration-150"
              >
                Start for Free <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

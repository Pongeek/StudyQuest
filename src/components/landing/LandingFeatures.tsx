"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Brain, Sword, Trophy } from "lucide-react";

const features = [
  {
    icon: Brain,
    iconColor: "text-indigo-400",
    title: "AI Course Analysis",
    desc: "Upload any PDF — Claude AI reads your material and builds a structured quest map with episodes, topics, and key concepts.",
  },
  {
    icon: Sword,
    iconColor: "text-indigo-400",
    title: "Smart Combat",
    desc: "Battle-test your knowledge with AI-generated questions. Open answers are graded with personalized feedback.",
  },
  {
    icon: Trophy,
    iconColor: "text-amber-400",
    title: "Level Up System",
    desc: "Earn XP, climb levels, unlock achievements, maintain streaks, and track mastery — from Novice to Master.",
  },
];

export default function LandingFeatures() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="container mx-auto px-6 py-20" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Your Study Arsenal</h2>
        <p className="text-slate-400 max-w-lg mx-auto">
          Every tool you need to conquer your courses.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {features.map(({ icon: Icon, iconColor, title, desc }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.15 }}
            className="rpg-card rounded-2xl p-7 group sparkle-hover tilt-card"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.15 }}
              className="w-10 h-10 bg-white/[0.04] border border-white/[0.07] rounded-lg flex items-center justify-center mb-5 transition-colors duration-150"
            >
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </motion.div>
            <h3 className="text-lg font-semibold mb-2 text-white tracking-tight">{title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

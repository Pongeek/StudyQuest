"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Scroll, Brain, Sword, Zap, Shield, ArrowRight } from "lucide-react";

const steps = [
  { step: "Upload PDF", icon: Scroll, iconColor: "text-indigo-400" },
  { step: "AI Builds Map", icon: Brain, iconColor: "text-indigo-400" },
  { step: "Answer Questions", icon: Sword, iconColor: "text-indigo-400" },
  { step: "Earn XP", icon: Zap, iconColor: "text-amber-400" },
  { step: "Master Topics", icon: Shield, iconColor: "text-emerald-400" },
];

export default function LandingSteps() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="container mx-auto px-6 py-20 text-center" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-4">The Quest Loop</h2>
        <p className="text-slate-400 mb-16 max-w-xl mx-auto">
          A simple, powerful cycle that turns any course into a journey.
        </p>
      </motion.div>

      <div className="flex flex-col md:flex-row items-center justify-center gap-3 max-w-4xl mx-auto">
        {steps.map(({ step, icon: Icon, iconColor }, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.12, type: "spring", damping: 15 }}
            className="flex items-center gap-3"
          >
            <div className="text-center group">
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.15 }}
                className="w-14 h-14 bg-white/[0.04] border border-white/[0.07] rounded-xl flex items-center justify-center mx-auto mb-3 cursor-default"
              >
                <Icon className={`w-6 h-6 ${iconColor}`} />
              </motion.div>
              <p className="text-sm text-slate-300 font-medium max-w-[100px] leading-tight">{step}</p>
            </div>
            {i < 4 && (
              <motion.div
                initial={{ opacity: 0, x: -5 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.4 + i * 0.12 }}
              >
                <ArrowRight className="w-5 h-5 text-slate-700 hidden md:block flex-shrink-0" />
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

interface AnimatedCounterProps {
  /** Target value to count up to */
  value: number;
  /** Duration in seconds */
  duration?: number;
  /** Prefix (e.g., "+") */
  prefix?: string;
  /** Suffix (e.g., "XP", "%") */
  suffix?: string;
  /** CSS class for the number */
  className?: string;
  /** Whether to format with locale commas */
  format?: boolean;
  /** Delay before starting in seconds */
  delay?: number;
}

export default function AnimatedCounter({
  value,
  duration = 1.2,
  prefix = "",
  suffix = "",
  className = "",
  format = true,
  delay = 0,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isInView || hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = performance.now() + delay * 1000;
    const endTime = startTime + duration * 1000;

    const tick = (now: number) => {
      if (now < startTime) {
        requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(1, (now - startTime) / (duration * 1000));
      // Ease out cubic for satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * value);
      setDisplay(current);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [isInView, value, duration, delay]);

  const formatted = format ? display.toLocaleString() : display.toString();

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.3, delay }}
    >
      {prefix}{formatted}{suffix}
    </motion.span>
  );
}

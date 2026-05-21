"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

/**
 * Three slow-pulsing radial blobs (indigo / purple / amber) that drift
 * subtly with the cursor, layered over a canvas constellation of small
 * violet nodes connected by faint threads. A 600px indigo spotlight follows
 * the mouse, edge-accent lines frame the viewport, and a slow-breathing
 * gridline overlay sits on top.
 *
 * Wrapped in a single `fixed inset-0 z-0` div so the whole atmosphere
 * stack is contained — internal z-indexes never beat the layout's z-10
 * main content.
 *
 * Honors prefers-reduced-motion (one static canvas frame, no animation).
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export default function AnimatedRPGBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Init to 1 to avoid divide-by-zero in the useTransform input ranges before
  // the first window measurement lands.
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 150, mass: 0.5 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  // Each blob shifts up to ±100px based on cursor position — three different
  // mappings so they drift in opposing directions, never in lockstep.
  const blob1X = useTransform(smoothMouseX, [0, dimensions.width], [0, 100]);
  const blob1Y = useTransform(smoothMouseY, [0, dimensions.height], [0, 100]);
  const blob2X = useTransform(smoothMouseX, [0, dimensions.width], [100, 0]);
  const blob2Y = useTransform(smoothMouseY, [0, dimensions.height], [100, 0]);
  const blob3X = useTransform(smoothMouseX, [0, dimensions.width], [50, -50]);
  const blob3Y = useTransform(smoothMouseY, [0, dimensions.height], [-50, 50]);

  // Cursor spotlight — subtle indigo glow following the mouse. useMotionTemplate
  // is required for the spring values to flow into a CSS string reactively.
  const spotlight = useMotionTemplate`radial-gradient(600px circle at ${smoothMouseX}px ${smoothMouseY}px, rgba(99, 102, 241, 0.06), transparent 40%)`;

  // Track viewport size + global mouse position
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    const onMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("resize", updateDimensions);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [mouseX, mouseY]);

  // Canvas particle field
  useEffect(() => {
    if (dimensions.width <= 1 || dimensions.height <= 1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // ~1 particle per 15000px² — gentler density than variant 4
    const particleCount = Math.floor(
      (dimensions.width * dimensions.height) / 15000
    );
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * dimensions.width,
      y: Math.random() * dimensions.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 1,
    }));

    const maxDistance = 120;

    const drawFrame = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      const particles = particlesRef.current;

      // Update positions + bounce off edges
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > dimensions.width) {
          p.vx = -p.vx;
          p.x = Math.max(0, Math.min(dimensions.width, p.x));
        }
        if (p.y < 0 || p.y > dimensions.height) {
          p.vy = -p.vy;
          p.y = Math.max(0, Math.min(dimensions.height, p.y));
        }
      }

      // Threads
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "rgba(139, 92, 246, 1)";
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDistance) {
            ctx.globalAlpha = (1 - dist / maxDistance) * 0.3;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      // Nodes
      ctx.fillStyle = "rgba(167, 139, 250, 0.6)";
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const animate = () => {
      drawFrame();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (prefersReducedMotion) {
      drawFrame();
    } else {
      animate();
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [dimensions]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Base diagonal lightening (slate-950 → slate-900 → slate-950) */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

      {/* Indigo blob — top-left, largest */}
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full blur-[120px] opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(99, 102, 241, 0.8) 0%, rgba(139, 92, 246, 0.4) 50%, transparent 70%)",
          left: "20%",
          top: "10%",
          x: blob1X,
          y: blob1Y,
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Purple blob — right-center */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full blur-[100px] opacity-25"
        style={{
          background:
            "radial-gradient(circle, rgba(168, 85, 247, 0.8) 0%, rgba(147, 51, 234, 0.4) 50%, transparent 70%)",
          right: "15%",
          top: "30%",
          x: blob2X,
          y: blob2Y,
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.25, 0.35, 0.25],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />

      {/* Amber blob — bottom-center, warm note */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full blur-[90px] opacity-15"
        style={{
          background:
            "radial-gradient(circle, rgba(251, 191, 36, 0.6) 0%, rgba(245, 158, 11, 0.3) 50%, transparent 70%)",
          left: "50%",
          bottom: "10%",
          x: blob3X,
          y: blob3Y,
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      {/* Constellation canvas */}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
      />

      {/* Floor + ceiling fade — anchors content */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40" />

      {/* Cursor spotlight */}
      <motion.div
        className="absolute inset-0"
        style={{ background: spotlight }}
      />

      {/* Edge accent lines */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
        <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-purple-500/20 to-transparent" />
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-amber-500/20 to-transparent" />
      </div>

      {/* Breathing gridlines */}
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: [0.03, 0.06, 0.03] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, rgba(99, 102, 241, 0.03) 0px, transparent 1px, transparent 40px, rgba(99, 102, 241, 0.03) 41px),
            repeating-linear-gradient(90deg, rgba(139, 92, 246, 0.03) 0px, transparent 1px, transparent 40px, rgba(139, 92, 246, 0.03) 41px)
          `,
        }}
      />
    </div>
  );
}

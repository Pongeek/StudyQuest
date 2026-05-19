"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface ConfettiPiece {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  speedY: number;
  speedX: number;
  rotation: number;
  rotSpeed: number;
  opacity: number;
  gravity: number;
}

const COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#f59e0b", // amber
  "#22c55e", // green
  "#3b82f6", // blue
  "#ec4899", // pink
  "#14b8a6", // teal
];

interface ConfettiProps {
  /** Fire confetti burst on mount or when trigger changes */
  trigger?: number;
  /** Number of pieces */
  count?: number;
  /** Duration in ms before fade out */
  duration?: number;
}

export default function Confetti({
  trigger = 0,
  count = 80,
  duration = 3000,
}: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [active, setActive] = useState(false);

  const fire = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    setActive(true);

    const pieces: ConfettiPiece[] = Array.from({ length: count }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight * 0.4,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      speedY: -(Math.random() * 12 + 6),
      speedX: (Math.random() - 0.5) * 10,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
      gravity: 0.25 + Math.random() * 0.1,
    }));

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const fadeFactor = elapsed > duration * 0.6
        ? 1 - (elapsed - duration * 0.6) / (duration * 0.4)
        : 1;

      if (elapsed > duration || fadeFactor <= 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setActive(false);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of pieces) {
        p.speedY += p.gravity;
        p.x += p.speedX;
        p.y += p.speedY;
        p.speedX *= 0.99;
        p.rotation += p.rotSpeed;
        p.opacity = Math.max(0, fadeFactor);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, [count, duration]);

  useEffect(() => {
    if (trigger > 0) fire();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [trigger, fire]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[100]"
      style={{
        width: "100vw",
        height: "100vh",
        display: active ? "block" : "none",
      }}
    />
  );
}

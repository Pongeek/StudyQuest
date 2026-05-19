"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
} from "react";
import { Sparkles } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BurstConfig {
  amount: number;
  /** Optional display label override (e.g. "combo") */
  label?: string;
  /** Viewport X in px — defaults to horizontal center */
  x?: number;
  /** Viewport Y in px — defaults to 40 % from top */
  y?: number;
  /** Combo count — when >= 2 a secondary sub-burst is shown */
  combo?: number;
}

interface BurstInstance extends BurstConfig {
  id: string;
}

interface XPBurstContextValue {
  fireBurst: (config: BurstConfig) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const XPBurstContext = createContext<XPBurstContextValue | null>(null);

export function useXPBurst(): XPBurstContextValue {
  const ctx = useContext(XPBurstContext);
  if (!ctx) throw new Error("useXPBurst must be used inside <XPBurstProvider>");
  return ctx;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tierClass(amount: number): {
  wrapper: string;
  text: string;
  showSpark: boolean;
  showRadial: boolean;
} {
  if (amount >= 61) {
    return {
      wrapper: "text-2xl font-black",
      text: "bg-gradient-to-b from-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_6px_rgba(245,158,11,0.7)]",
      showSpark: true,
      showRadial: true,
    };
  }
  if (amount >= 21) {
    return {
      wrapper: "text-xl font-extrabold",
      text: "text-amber-400",
      showSpark: true,
      showRadial: false,
    };
  }
  return {
    wrapper: "text-lg font-bold",
    text: "text-amber-200/90",
    showSpark: false,
    showRadial: false,
  };
}

// ─── Single burst element ─────────────────────────────────────────────────────

function BurstElement({ burst }: { burst: BurstInstance }) {
  const { wrapper, text, showSpark, showRadial } = tierClass(burst.amount);

  const left = burst.x ?? (typeof window !== "undefined" ? window.innerWidth / 2 : 200);
  const top = burst.y ?? (typeof window !== "undefined" ? window.innerHeight * 0.4 : 300);

  const label = burst.label ?? `+${burst.amount} XP`;
  const comboLabel =
    burst.combo != null && burst.combo >= 2
      ? `+${burst.combo * 15} combo`
      : null;

  return (
    <div
      className="pointer-events-none fixed z-[200] select-none"
      style={{ left, top, transform: "translate(-50%, -50%)" }}
      aria-live="assertive"
      aria-label={label}
    >
      {/* Radial burst behind — critical tier only, one pop */}
      {showRadial && (
        <div
          className="absolute inset-0 rounded-full animate-score-burst opacity-0"
          style={{
            width: 80,
            height: 80,
            marginLeft: -24,
            marginTop: -20,
            background:
              "radial-gradient(circle, rgba(245,158,11,0.45) 0%, transparent 70%)",
          }}
        />
      )}

      {/* Main XP label */}
      <div
        className={`${wrapper} xp-burst-float flex items-center gap-1`}
        style={{ fontFamily: "var(--font-pixel, monospace)", fontSize: "inherit" }}
      >
        {showSpark && (
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 xp-burst-float" />
        )}
        <span className={text}>{label}</span>
      </div>

      {/* Combo sub-burst */}
      {comboLabel && (
        <div
          className="text-sm font-bold text-amber-300/80 xp-burst-float mt-0.5 text-center"
          style={{ animationDelay: "0.12s" }}
        >
          {comboLabel}
        </div>
      )}
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function XPBurstProvider({ children }: { children: React.ReactNode }) {
  const [bursts, setBursts] = useState<BurstInstance[]>([]);
  const counterRef = useRef(0);
  const baseId = useId();

  const fireBurst = useCallback((config: BurstConfig) => {
    const id = `${baseId}-${++counterRef.current}`;
    setBursts((prev) => [...prev, { ...config, id }]);
    // Remove after animation completes (1.4 s)
    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, 1400);
  }, [baseId]);

  return (
    <XPBurstContext.Provider value={{ fireBurst }}>
      {children}
      {bursts.map((b) => (
        <BurstElement key={b.id} burst={b} />
      ))}
    </XPBurstContext.Provider>
  );
}

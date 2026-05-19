"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface AutoRecoverBoundaryProps {
  children: React.ReactNode;
  /** Identifier shown in console + logged for debugging */
  label?: string;
  /** Optional override for the fallback UI shown briefly during recovery */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches any render error inside its children and triggers a soft recovery
 * by calling `router.refresh()` — which re-fetches the current route from
 * the server. Used to wrap engine-rendered components (ExamEngine's inline
 * debrief, etc.) where a transient client-side issue would otherwise show
 * the browser's "This page couldn't load" error.
 *
 * The fallback UI flashes briefly (≤500ms typically) before the server
 * re-render lands. From the user's perspective the bad render just
 * disappears and the correct one appears.
 */
class AutoRecoverBoundaryInner extends React.Component<
  AutoRecoverBoundaryProps & { onError: (err: Error) => void },
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log the full error to the console + Vercel function logs so we can
    // diagnose any genuine bugs (not just transient race conditions).
    console.error(
      `[AutoRecoverBoundary${this.props.label ? `:${this.props.label}` : ""}] caught render error:`,
      error,
      info
    );
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-[40vh] flex items-center justify-center">
            <div className="text-center text-slate-400">
              <div className="text-3xl mb-3">⏳</div>
              <p className="text-sm">Reloading your results…</p>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

/**
 * Functional wrapper that injects the router so the class-based boundary
 * can call `router.refresh()` on error. We trigger the refresh in an effect
 * (via the parent functional component) so React doesn't complain about
 * setState during render.
 */
export default function AutoRecoverBoundary(props: AutoRecoverBoundaryProps) {
  const router = useRouter();
  const [errorVersion, setErrorVersion] = React.useState(0);

  React.useEffect(() => {
    if (errorVersion > 0) {
      // Small delay so the fallback UI gets a paint frame before the
      // refresh kicks in — feels less jarring than an instant swap.
      const t = setTimeout(() => router.refresh(), 100);
      return () => clearTimeout(t);
    }
  }, [errorVersion, router]);

  return (
    <AutoRecoverBoundaryInner
      {...props}
      onError={() => setErrorVersion((v) => v + 1)}
    />
  );
}

"use client";

import { useEffect, useRef } from "react";

export type AuroraMotionState = "idle" | "submitting" | "entering";

interface AuroraCurtainsProps {
  state?: AuroraMotionState;
}

const TARGET_SPEED: Record<AuroraMotionState, number> = {
  idle: 1.0,
  submitting: 4.8,
  entering: 5.8,
};

export function AuroraCurtains({ state = "idle" }: AuroraCurtainsProps) {
  const bandARef = useRef<HTMLDivElement>(null);
  const bandBRef = useRef<HTMLDivElement>(null);
  const bandCRef = useRef<HTMLDivElement>(null);
  const targetSpeedRef = useRef<number>(TARGET_SPEED[state]);

  useEffect(() => {
    targetSpeedRef.current = TARGET_SPEED[state];
  }, [state]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let phase = 0;
    let speed = targetSpeedRef.current;
    let lastTs = performance.now();
    let rafId = 0;

    const frame = (ts: number) => {
      const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
      lastTs = ts;

      speed += (targetSpeedRef.current - speed) * 0.085;
      phase += dt * speed * 0.85;

      const boost = Math.max(0, (speed - 1) / 4);
      const sway = 22 + boost * 14;

      if (bandARef.current) {
        bandARef.current.style.transform = `translate3d(${Math.sin(phase * 0.6) * sway}%, ${Math.cos(phase * 0.4) * 7}%, 0) skewX(${-12 + Math.sin(phase * 0.5) * 10}deg) scaleY(${1 + boost * 0.12})`;
      }
      if (bandBRef.current) {
        bandBRef.current.style.transform = `translate3d(${Math.cos(phase * 0.52 + 1.4) * sway}%, ${Math.sin(phase * 0.45) * -7}%, 0) skewX(${10 + Math.cos(phase * 0.45) * 11}deg) scaleY(${1 + boost * 0.14})`;
      }
      if (bandCRef.current) {
        bandCRef.current.style.transform = `translate3d(${Math.sin(phase * 0.7 + 2.7) * sway}%, ${Math.cos(phase * 0.55) * 9}%, 0) skewX(${-8 + Math.sin(phase * 0.6) * 9}deg) scaleY(${1 + boost * 0.15})`;
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      data-aurora-state={state}
      className="strata-curtain-layer"
    >
      <div ref={bandARef} className="strata-curtain-band strata-curtain-a" />
      <div ref={bandBRef} className="strata-curtain-band strata-curtain-b" />
      <div ref={bandCRef} className="strata-curtain-band strata-curtain-c" />
    </div>
  );
}

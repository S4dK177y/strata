"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, type RefObject } from "react";
import { cn } from "@/lib/utils";

interface LiquidNavIndicatorProps {
  containerRef: RefObject<HTMLElement | null>;
  activeKey: string | null;
  variant: "desktop" | "mobile";
}

interface TargetBox {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
}

interface SpringPair {
  x: number;
  w: number;
  vx: number;
  vw: number;
}

interface PhysicsState {
  initialized: boolean;
  target: TargetBox;
  head: SpringPair;
  tail: SpringPair;
  rafId: number | null;
  lastTs: number;
  activeKey: string | null;
}

function createEmptyBox(): TargetBox {
  return { x: 0, y: 0, w: 0, h: 0, rx: 16 };
}

function createEmptySpring(): SpringPair {
  return { x: 0, w: 0, vx: 0, vw: 0 };
}

function setRectAttrs(
  el: SVGRectElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number
) {
  if (!el) return;
  el.setAttribute("x", x.toFixed(2));
  el.setAttribute("y", y.toFixed(2));
  el.setAttribute("width", Math.max(0, w).toFixed(2));
  el.setAttribute("height", Math.max(0, h).toFixed(2));
  el.setAttribute("rx", Math.max(0, rx).toFixed(2));
}

function stepSpring(
  val: number,
  vel: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number
): [number, number] {
  const force = (target - val) * stiffness;
  const nextVel = (vel + force * dt) * Math.exp(-damping * dt);
  const nextVal = val + nextVel * dt;
  return [nextVal, nextVel];
}

export function LiquidNavIndicator({
  containerRef,
  activeKey,
  variant,
}: LiquidNavIndicatorProps) {
  const rawId = useId();
  const filterId = `strata-nav-goo-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const bridgeRef = useRef<SVGRectElement>(null);
  const tailRef = useRef<SVGRectElement>(null);
  const headRef = useRef<SVGRectElement>(null);

  const physicsRef = useRef<PhysicsState>({
    initialized: false,
    target: createEmptyBox(),
    head: createEmptySpring(),
    tail: createEmptySpring(),
    rafId: null,
    lastTs: 0,
    activeKey: null,
  });

  const measureBox = useCallback(
    (key: string | null): TargetBox | null => {
      const container = containerRef.current;
      if (!container || !key) return null;

      const containerRect = container.getBoundingClientRect();
      if (containerRect.width <= 0 || containerRect.height <= 0) return null;

      const selectorKey = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(key) : key;
      const item = container.querySelector<HTMLElement>(`[data-nav-key="${selectorKey}"]`);
      if (!item) return null;

      const itemRect = item.getBoundingClientRect();
      if (itemRect.width <= 0 || itemRect.height <= 0) return null;

      const insetX = variant === "mobile" ? 3 : 0;
      const insetY = variant === "mobile" ? 2 : 0;
      const w = Math.max(8, itemRect.width - insetX * 2);
      const h = Math.max(8, itemRect.height - insetY * 2);
      const x = itemRect.left - containerRect.left + insetX;
      const y = itemRect.top - containerRect.top + insetY;
      const rx = variant === "mobile" ? 16 : h / 2;

      return { x, y, w, h, rx };
    },
    [containerRef, variant]
  );

  const snapToBox = useCallback((box: TargetBox) => {
    const state = physicsRef.current;
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }

    state.target = { ...box };
    state.head = { x: box.x, w: box.w, vx: 0, vw: 0 };
    state.tail = { x: box.x, w: box.w, vx: 0, vw: 0 };
    state.initialized = true;

    setRectAttrs(headRef.current, box.x, box.y, box.w, box.h, box.rx);
    setRectAttrs(tailRef.current, box.x, box.y, box.w, box.h, box.rx);
    if (bridgeRef.current) {
      bridgeRef.current.setAttribute("opacity", "0");
    }
    groupRef.current?.removeAttribute("filter");
  }, []);

  const startLoop = useCallback(() => {
    const state = physicsRef.current;
    if (state.rafId !== null) return;

    state.lastTs = performance.now();

    const step = (now: number) => {
      const s = physicsRef.current;
      const dt = Math.min(0.032, Math.max(0.004, (now - s.lastTs) / 1000));
      s.lastTs = now;

      const [hx, hvx] = stepSpring(s.head.x, s.head.vx, s.target.x, 330, 18, dt);
      const [hw, hvw] = stepSpring(s.head.w, s.head.vw, s.target.w, 330, 18, dt);
      s.head = { x: hx, w: hw, vx: hvx, vw: hvw };

      const [tx, tvx] = stepSpring(s.tail.x, s.tail.vx, s.target.x, 155, 14, dt);
      const [tw, tvw] = stepSpring(s.tail.w, s.tail.vw, s.target.w, 155, 14, dt);
      s.tail = { x: tx, w: tw, vx: tvx, vw: tvw };

      const headCenter = s.head.x + s.head.w / 2;
      const tailCenter = s.tail.x + s.tail.w / 2;
      const sep = Math.abs(headCenter - tailCenter);
      const stretch = Math.min(1, sep / 85);

      const centerY = s.target.y + s.target.h / 2;
      const headH = s.target.h * (1 - stretch * 0.13);
      const tailH = s.target.h * (1 - stretch * 0.24);
      const headY = centerY - headH / 2;
      const tailY = centerY - tailH / 2;

      setRectAttrs(headRef.current, s.head.x, headY, s.head.w, headH, headH / 2);
      setRectAttrs(tailRef.current, s.tail.x, tailY, s.tail.w, tailH, tailH / 2);

      if (bridgeRef.current) {
        if (sep > 6) {
          const left = Math.min(headCenter, tailCenter);
          const right = Math.max(headCenter, tailCenter);
          const bridgeH = s.target.h * Math.max(0.42, 0.72 - stretch * 0.26);
          const bridgeY = centerY - bridgeH / 2;
          setRectAttrs(
            bridgeRef.current,
            left,
            bridgeY,
            Math.max(4, right - left),
            bridgeH,
            bridgeH / 2
          );
          bridgeRef.current.setAttribute("opacity", "1");
        } else {
          bridgeRef.current.setAttribute("opacity", "0");
        }
      }

      const speed =
        Math.abs(s.head.vx) + Math.abs(s.tail.vx) + Math.abs(s.head.vw) + Math.abs(s.tail.vw);

      if (sep > 0.6 || speed > 1.5) {
        groupRef.current?.setAttribute("filter", `url(#${filterId})`);
      }

      const settled =
        Math.abs(s.head.x - s.target.x) < 0.25 &&
        Math.abs(s.tail.x - s.target.x) < 0.25 &&
        Math.abs(s.head.w - s.target.w) < 0.25 &&
        Math.abs(s.tail.w - s.target.w) < 0.25 &&
        speed < 0.8;

      if (settled) {
        snapToBox(s.target);
        return;
      }

      s.rafId = requestAnimationFrame(step);
    };

    state.rafId = requestAnimationFrame(step);
  }, [filterId, snapToBox]);

  useLayoutEffect(() => {
    const state = physicsRef.current;
    state.activeKey = activeKey;

    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    if (!activeKey) {
      svg.style.opacity = "0";
      return;
    }

    const box = measureBox(activeKey);
    if (!box) return;

    container.dataset.liquidReady = "true";
    svg.style.opacity = "";

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!state.initialized || reducedMotion) {
      snapToBox(box);
      return;
    }

    state.target = box;
    startLoop();
  }, [activeKey, containerRef, measureBox, snapToBox, startLoop]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      const state = physicsRef.current;
      const box = measureBox(state.activeKey);
      if (!box) return;

      container.dataset.liquidReady = "true";
      if (svgRef.current) {
        svgRef.current.style.opacity = "";
      }

      if (state.rafId !== null) {
        state.target = box;
      } else {
        snapToBox(box);
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    window.addEventListener("resize", handleResize, { passive: true });

    const stateAtMount = physicsRef.current;
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      if (stateAtMount.rafId !== null) {
        cancelAnimationFrame(stateAtMount.rafId);
        stateAtMount.rafId = null;
      }
    };
  }, [containerRef, measureBox, snapToBox]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className={cn(
        "strata-liquid-svg pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible",
        variant === "mobile" ? "strata-liquid-mobile-svg" : "strata-liquid-desktop-svg"
      )}
    >
      <defs>
        <filter
          id={filterId}
          x="-25%"
          y="-80%"
          width="150%"
          height="260%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation={variant === "desktop" ? 5.5 : 6.5}
            result="blur"
          />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
            result="goo"
          />
        </filter>
      </defs>
      <g ref={groupRef}>
        <rect
          ref={bridgeRef}
          x="0"
          y="0"
          width="0"
          height="0"
          rx="16"
          opacity="0"
          fill="var(--strata-accent-brand)"
        />
        <rect
          ref={tailRef}
          x="0"
          y="0"
          width="0"
          height="0"
          rx="16"
          fill="var(--strata-accent-brand)"
        />
        <rect
          ref={headRef}
          x="0"
          y="0"
          width="0"
          height="0"
          rx="16"
          fill="var(--strata-accent-brand)"
        />
      </g>
    </svg>
  );
}

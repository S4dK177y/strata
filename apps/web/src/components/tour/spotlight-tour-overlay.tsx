"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { findVisibleTourTarget, TOUR_STEPS } from "./tour-steps";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SpotlightTourOverlayProps {
  open: boolean;
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

const SPOTLIGHT_PADDING = 8;

export function SpotlightTourOverlay({
  open,
  stepIndex,
  onNext,
  onPrev,
  onSkip,
  onFinish,
}: SpotlightTourOverlayProps) {
  const { t } = useI18n();
  const maskId = useId();
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [viewport, setViewport] = useState({ width: 1280, height: 800 });

  const step = TOUR_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  useEffect(() => {
    if (!open || !step) return;

    const target = findVisibleTourTarget(step.id);
    if (target) {
      const rect = target.getBoundingClientRect();
      const outOfView = rect.top < 72 || rect.bottom > window.innerHeight - 88;
      if (outOfView) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    const updateRect = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const el = findVisibleTourTarget(step.id);
      if (!el) {
        setTargetRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setTargetRect({
        top: Math.max(4, r.top - SPOTLIGHT_PADDING),
        left: Math.max(4, r.left - SPOTLIGHT_PADDING),
        width: Math.min(window.innerWidth - 8, r.width + SPOTLIGHT_PADDING * 2),
        height: Math.min(window.innerHeight - 8, r.height + SPOTLIGHT_PADDING * 2),
      });
    };

    const rafId = window.requestAnimationFrame(updateRect);
    const timer = window.setTimeout(updateRect, 260);
    const observer = target ? new ResizeObserver(updateRect) : null;
    if (observer && target) observer.observe(target);

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (isLast) onFinish();
        else onNext();
      } else if (e.key === "ArrowLeft" && !isFirst) {
        e.preventDefault();
        onPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isFirst, isLast, onFinish, onNext, onPrev, onSkip]);

  if (!open || !step || typeof document === "undefined") {
    return null;
  }

  const cardWidth = Math.min(360, viewport.width - 24);
  const estimatedCardHeight = 220;

  let popoverTop = Math.max(12, Math.round((viewport.height - estimatedCardHeight) / 2));
  let popoverLeft = Math.max(12, Math.round((viewport.width - cardWidth) / 2));

  if (targetRect) {
    const spaceBelow = viewport.height - (targetRect.top + targetRect.height);
    const spaceAbove = targetRect.top;

    if (spaceBelow >= estimatedCardHeight + 20) {
      popoverTop = targetRect.top + targetRect.height + 14;
    } else if (spaceAbove >= estimatedCardHeight + 20) {
      popoverTop = Math.max(12, targetRect.top - estimatedCardHeight - 14);
    } else {
      popoverTop = Math.max(12, Math.min(viewport.height - estimatedCardHeight - 12, 76));
    }

    const centeredLeft = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    popoverLeft = Math.max(12, Math.min(viewport.width - cardWidth - 12, Math.round(centeredLeft)));
  }

  const copy = t.tour.steps[step.id];

  return createPortal(
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="strata-tour-title"
      aria-describedby="strata-tour-desc"
    >
      {/* SVG Backdrop with rounded spotlight cutout */}
      <svg
        className="fixed inset-0 h-full w-full"
        width={viewport.width}
        height={viewport.height}
        aria-hidden="true"
        onClick={onSkip}
      >
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect ? (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx={20}
                ry={20}
                fill="black"
              />
            ) : null}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(4, 6, 10, 0.70)"
          mask={`url(#${maskId})`}
        />
      </svg>

      {/* Glowing Accent Frame around target */}
      {targetRect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-[20px] border-2 border-[var(--strata-accent-brand)] transition-all duration-200"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: "0 0 0 4px color-mix(in srgb, var(--strata-accent-brand) 22%, transparent)",
          }}
        />
      ) : null}

      {/* Tour Step Popover */}
      <div
        className="fixed z-10 rounded-3xl border border-[var(--strata-border-strong)] bg-[var(--strata-bg-surface)] p-5 shadow-2xl transition-all duration-200"
        style={{
          top: popoverTop,
          left: popoverLeft,
          width: cardWidth,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="strata-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--strata-accent-brand)]">
              {t.tour.stepCounter
                .replace("{current}", String(stepIndex + 1))
                .replace("{total}", String(TOUR_STEPS.length))}
            </div>
            <h3
              id="strata-tour-title"
              className="text-base font-bold text-[var(--strata-text-primary)]"
            >
              {copy.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onSkip}
            aria-label={t.common.close}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--strata-text-muted)] transition hover:bg-[var(--strata-bg-elevated)] hover:text-[var(--strata-text-primary)]"
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <p
          id="strata-tour-desc"
          className="mt-2 text-sm leading-relaxed text-[var(--strata-text-secondary)]"
        >
          {copy.description}
        </p>

        {/* Step dots */}
        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {TOUR_STEPS.map((s, idx) => (
            <span
              key={s.id}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === stepIndex
                  ? "w-5 bg-[var(--strata-accent-brand)]"
                  : "w-1.5 bg-[var(--strata-border-strong)]"
              )}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="min-h-9 cursor-pointer rounded-xl px-2 text-xs font-semibold text-[var(--strata-text-muted)] transition hover:text-[var(--strata-text-primary)]"
          >
            {t.tour.skip}
          </button>

          <div className="flex items-center gap-2">
            {!isFirst ? (
              <Button type="button" variant="secondary" size="sm" onClick={onPrev}>
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t.common.back}
              </Button>
            ) : null}

            {isLast ? (
              <Button type="button" size="sm" onClick={onFinish}>
                <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {t.tour.finish}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={onNext}>
                {t.common.next}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

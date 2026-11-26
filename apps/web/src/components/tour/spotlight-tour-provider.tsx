"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Profile } from "@strata/api-contract";
import { SpotlightTourOverlay } from "./spotlight-tour-overlay";
import { TOUR_STEPS } from "./tour-steps";

interface SpotlightTourContextValue {
  isOpen: boolean;
  stepIndex: number;
  startTour: () => void;
  closeTour: () => void;
}

const SpotlightTourContext = createContext<SpotlightTourContextValue | null>(null);

function getLocalTourKey(userId: string): string {
  return `strata-tour-done:${userId}`;
}

export function SpotlightTourProvider({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const autoCheckedRef = useRef(false);

  const persistTourCompletion = useCallback(async () => {
    try {
      localStorage.setItem(getLocalTourKey(profile.id), "1");
    } catch {
      // Ignore storage errors
    }

    try {
      await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tour_completed_at: new Date().toISOString() }),
      });
    } catch {
      // Best-effort sync
    }
  }, [profile.id]);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
    void persistTourCompletion();
  }, [persistTourCompletion]);

  // Handle explicit replay via ?tour=1 on "/"
  useEffect(() => {
    if (pathname !== "/" || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1") {
      const t = window.setTimeout(() => {
        setStepIndex(0);
        setIsOpen(true);
        router.replace("/");
      }, 200);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [pathname, router]);

  // Auto-launch once after onboarding completes
  useEffect(() => {
    if (autoCheckedRef.current) return;
    if (pathname !== "/") return;
    if (!profile.onboarding_completed || profile.tour_completed_at !== null) return;

    autoCheckedRef.current = true;
    try {
      if (localStorage.getItem(getLocalTourKey(profile.id)) === "1") {
        return;
      }
    } catch {
      // Continue
    }

    const timer = window.setTimeout(() => {
      setStepIndex(0);
      setIsOpen(true);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [pathname, profile.id, profile.onboarding_completed, profile.tour_completed_at]);

  return (
    <SpotlightTourContext.Provider value={{ isOpen, stepIndex, startTour, closeTour }}>
      {children}
      <SpotlightTourOverlay
        open={isOpen}
        stepIndex={stepIndex}
        onNext={() => setStepIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1))}
        onPrev={() => setStepIndex((i) => Math.max(0, i - 1))}
        onSkip={closeTour}
        onFinish={closeTour}
      />
    </SpotlightTourContext.Provider>
  );
}

export function useSpotlightTour() {
  const ctx = useContext(SpotlightTourContext);
  if (!ctx) {
    throw new Error("useSpotlightTour must be used within SpotlightTourProvider");
  }
  return ctx;
}

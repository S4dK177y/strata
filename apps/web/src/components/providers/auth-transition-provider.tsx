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
import { usePathname } from "next/navigation";

export interface AuthTransitionOrigin {
  x: number;
  y: number;
}

interface FlashState {
  id: number;
  phase: "rising" | "clearing";
  x: number;
  y: number;
  startPath: string;
}

interface AuthTransitionContextValue {
  triggerAuthFlash: (origin?: AuthTransitionOrigin) => void;
}

const AuthTransitionContext = createContext<AuthTransitionContextValue>({
  triggerAuthFlash: () => {},
});

export function AuthTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [flash, setFlash] = useState<FlashState | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    if (clearEndTimerRef.current) {
      clearTimeout(clearEndTimerRef.current);
      clearEndTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const triggerAuthFlash = useCallback(
    (origin?: AuthTransitionOrigin) => {
      if (
        typeof window === "undefined" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      clearTimers();
      const id = Date.now();
      const x = origin?.x ?? window.innerWidth / 2;
      const y = origin?.y ?? window.innerHeight * 0.62;

      setFlash({
        id,
        phase: "rising",
        x,
        y,
        startPath: pathname,
      });

      safetyTimerRef.current = setTimeout(() => {
        setFlash((prev) =>
          prev && prev.id === id ? { ...prev, phase: "clearing" } : prev
        );
        clearEndTimerRef.current = setTimeout(() => {
          setFlash((prev) => (prev && prev.id === id ? null : prev));
        }, 440);
      }, 2400);
    },
    [clearTimers, pathname]
  );

  useEffect(() => {
    if (!flash || flash.phase !== "rising" || pathname === flash.startPath) {
      return;
    }

    clearTimers();
    const activeId = flash.id;
    const t1 = setTimeout(() => {
      setFlash((prev) =>
        prev && prev.id === activeId ? { ...prev, phase: "clearing" } : prev
      );
    }, 90);
    const t2 = setTimeout(() => {
      setFlash((prev) => (prev && prev.id === activeId ? null : prev));
    }, 530);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [clearTimers, flash, pathname]);

  return (
    <AuthTransitionContext.Provider value={{ triggerAuthFlash }}>
      {children}
      {flash ? (
        <div
          aria-hidden="true"
          data-phase={flash.phase}
          className="strata-auth-flash-overlay"
        >
          <div className="strata-auth-flash-veil" />
          <div
            className="strata-auth-flash-bloom"
            style={{ left: `${flash.x}px`, top: `${flash.y}px` }}
          />
        </div>
      ) : null}
    </AuthTransitionContext.Provider>
  );
}

export function useAuthTransition(): AuthTransitionContextValue {
  return useContext(AuthTransitionContext);
}

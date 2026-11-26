"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface PrivacyContextValue {
  privacyBlur: boolean;
  setPrivacyBlur: (next: boolean) => void;
  togglePrivacyBlur: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [privacyBlur, setPrivacyBlurState] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("privacy-blur", privacyBlur);
  }, [privacyBlur]);

  const setPrivacyBlur = useCallback((next: boolean) => {
    setPrivacyBlurState(next);
  }, []);

  const togglePrivacyBlur = useCallback(() => {
    setPrivacyBlurState((prev) => !prev);
  }, []);

  const value = useMemo<PrivacyContextValue>(
    () => ({
      privacyBlur,
      setPrivacyBlur,
      togglePrivacyBlur,
    }),
    [privacyBlur, setPrivacyBlur, togglePrivacyBlur]
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) {
    throw new Error("usePrivacy must be used within PrivacyProvider");
  }
  return ctx;
}

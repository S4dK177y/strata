export type TourStepId =
  | "hero-balance"
  | "privacy-toggle"
  | "quick-add"
  | "analytics-charts"
  | "nav-sections"
  | "settings-link";

export interface TourStepConfig {
  id: TourStepId;
}

export const TOUR_STEPS: TourStepConfig[] = [
  { id: "hero-balance" },
  { id: "privacy-toggle" },
  { id: "quick-add" },
  { id: "analytics-charts" },
  { id: "nav-sections" },
  { id: "settings-link" },
];

export function findVisibleTourTarget(stepId: TourStepId): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-tour="${stepId}"]`)
  );
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return el;
    }
  }
  return null;
}

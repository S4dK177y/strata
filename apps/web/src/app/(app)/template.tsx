import type { ReactNode } from "react";

export default function AppSectionTemplate({ children }: { children: ReactNode }) {
  return <div className="strata-page-enter">{children}</div>;
}

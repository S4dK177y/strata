export default function CapitalLoading() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <div className="strata-skeleton h-7 w-32 rounded-xl bg-[var(--strata-bg-surface)]" />
          <div className="strata-skeleton h-10 w-32 shrink-0 rounded-2xl bg-[var(--strata-bg-surface)] sm:w-36" />
        </div>
        <div className="strata-skeleton h-4 w-72 max-w-full rounded-lg bg-[var(--strata-bg-surface)]" />
      </div>

      {/* Tabs Switcher (Full-width symmetric on Mobile, compact inline on sm+) */}
      <div className="strata-skeleton h-12 w-full rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] sm:w-72" />

      {/* Unified Portfolio Allocation Card */}
      <div className="strata-skeleton h-32 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />

      {/* Grouped Account Cards */}
      <div className="space-y-2.5">
        <div className="strata-skeleton h-3.5 w-36 rounded-md bg-[var(--strata-bg-surface)]" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
          <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="strata-skeleton h-3.5 w-32 rounded-md bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-28 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
      </div>
    </div>
  );
}

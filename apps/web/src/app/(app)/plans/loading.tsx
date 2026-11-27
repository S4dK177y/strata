export default function PlansLoading() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <div className="strata-skeleton h-7 w-28 rounded-xl bg-[var(--strata-bg-surface)]" />
          <div className="strata-skeleton h-10 w-32 shrink-0 rounded-2xl bg-[var(--strata-bg-surface)] sm:w-40" />
        </div>
        <div className="strata-skeleton h-4 w-72 max-w-full rounded-lg bg-[var(--strata-bg-surface)]" />
      </div>

      {/* Tabs Switcher (2x2 on Mobile, 4-column inline on sm+) */}
      <div className="strata-skeleton h-[92px] w-full rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] sm:h-12 sm:w-[540px]" />

      {/* Unified Summary Card */}
      <div className="strata-skeleton h-36 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />

      {/* 2-column Cards Grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="strata-skeleton h-44 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-44 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
      </div>
    </div>
  );
}

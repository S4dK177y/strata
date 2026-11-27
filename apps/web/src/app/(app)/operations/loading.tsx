export default function OperationsLoading() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 sm:items-center">
        <div className="space-y-2">
          <div className="strata-skeleton h-7 w-36 rounded-xl bg-[var(--strata-bg-surface)]" />
          <div className="strata-skeleton h-4 w-44 max-w-full rounded-lg bg-[var(--strata-bg-surface)]" />
        </div>
      </div>

      {/* Unified Period & Zero-Truncation Cashflow Summary Card */}
      <div className="space-y-3.5 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="strata-skeleton h-9 w-9 rounded-full bg-[var(--strata-bg-elevated)]" />
            <div className="strata-skeleton h-5 w-28 rounded-full bg-[var(--strata-bg-elevated)] sm:w-32" />
            <div className="strata-skeleton h-9 w-9 rounded-full bg-[var(--strata-bg-elevated)]" />
          </div>
          <div className="strata-skeleton h-9 w-28 rounded-full bg-[var(--strata-bg-elevated)]" />
        </div>

        {/* Mobile Saldo + 2-col Income/Expense Skeleton */}
        <div className="space-y-2.5 sm:hidden">
          <div className="strata-skeleton h-11 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="grid grid-cols-2 gap-2.5">
            <div className="strata-skeleton h-16 rounded-2xl bg-[var(--strata-bg-elevated)]" />
            <div className="strata-skeleton h-16 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          </div>
        </div>

        {/* Desktop 3-col KPI Skeleton */}
        <div className="hidden sm:grid sm:grid-cols-3 sm:gap-3">
          <div className="strata-skeleton h-20 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-20 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-20 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        </div>

        <div className="strata-skeleton h-1.5 w-full rounded-full bg-[var(--strata-bg-elevated)]" />
      </div>

      {/* Compact Search + Filters Bar & Quick Chips */}
      <div className="space-y-2.5 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-3.5 sm:p-4">
        <div className="flex items-center gap-2">
          <div className="strata-skeleton h-10 flex-1 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-10 w-24 shrink-0 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <div className="strata-skeleton h-8 w-14 rounded-full bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-8 w-20 rounded-full bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-8 w-20 rounded-full bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-8 w-22 rounded-full bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-8 w-24 rounded-full bg-[var(--strata-bg-elevated)]" />
        </div>
      </div>

      {/* Grouped Transaction Rows */}
      <div className="space-y-3 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-4 sm:p-5">
        <div className="strata-skeleton h-4 w-24 rounded-lg bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
      </div>
    </div>
  );
}

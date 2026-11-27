export default function OverviewLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      {/* Aurora Hero Metric Board Skeleton (Variant C) */}
      <div className="rounded-[28px] border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-4 sm:p-6 lg:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-center justify-between gap-2 lg:justify-start">
              <div className="strata-skeleton h-3.5 w-28 rounded-full bg-[var(--strata-bg-elevated)]" />
              <div className="strata-skeleton h-8 w-8 rounded-full bg-[var(--strata-bg-elevated)]" />
            </div>
            <div className="strata-skeleton h-10 w-52 max-w-full rounded-2xl bg-[var(--strata-bg-elevated)] sm:h-11 sm:w-64" />
            <div className="strata-skeleton hidden h-3 w-72 rounded-full bg-[var(--strata-bg-elevated)] lg:block" />
          </div>

          <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--strata-border-subtle)] pt-3.5 lg:w-[440px] lg:shrink-0 lg:gap-3.5 lg:border-t-0 lg:pt-0">
            <div className="strata-skeleton h-[72px] rounded-2xl bg-[var(--strata-bg-elevated)] lg:h-[88px]" />
            <div className="strata-skeleton h-[72px] rounded-2xl bg-[var(--strata-bg-elevated)] lg:h-[88px]" />
          </div>
        </div>
      </div>

      {/* Period Selector & Order Controls Skeleton */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
          <div className="strata-skeleton h-10 w-10 rounded-full bg-[var(--strata-bg-surface)]" />
          <div className="strata-skeleton h-5 w-32 rounded-full bg-[var(--strata-bg-surface)]" />
          <div className="strata-skeleton h-10 w-10 rounded-full bg-[var(--strata-bg-surface)]" />
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <div className="strata-skeleton h-10 w-36 rounded-full bg-[var(--strata-bg-surface)]" />
          <div className="strata-skeleton h-9 w-24 rounded-full bg-[var(--strata-bg-surface)]" />
        </div>
      </div>

      {/* 4 Analytics KPI Cards Skeleton */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
      </div>

      {/* Category Breakdown Skeleton */}
      <div className="strata-skeleton h-56 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] lg:h-80" />

      {/* Cashflow Trend Chart Skeleton */}
      <div className="strata-skeleton h-64 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />

      {/* Accounts List Skeleton */}
      <div className="space-y-3 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="strata-skeleton h-5 w-32 rounded-xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-4 w-20 rounded-lg bg-[var(--strata-bg-elevated)]" />
        </div>
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
      </div>
    </div>
  );
}

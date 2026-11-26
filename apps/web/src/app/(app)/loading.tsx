export default function OverviewLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      {/* Aurora Hero Skeleton */}
      <div className="space-y-6 rounded-[28px] border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-5 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="strata-skeleton h-3.5 w-28 rounded-full bg-[var(--strata-bg-elevated)]" />
            <div className="strata-skeleton h-10 w-52 rounded-2xl bg-[var(--strata-bg-elevated)] sm:h-12 sm:w-72" />
          </div>
          <div className="strata-skeleton h-7 w-36 rounded-full bg-[var(--strata-bg-elevated)]" />
        </div>
        <div className="strata-skeleton h-7 w-48 rounded-full bg-[var(--strata-bg-elevated)]" />
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="strata-skeleton h-20 rounded-[22px] bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-20 rounded-[22px] bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-20 rounded-[22px] bg-[var(--strata-bg-elevated)]" />
        </div>
      </div>

      {/* Monthly Cashflow Snapshot Skeleton */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton col-span-2 h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] sm:col-span-1" />
      </div>

      {/* Accounts List Skeleton */}
      <div className="space-y-3 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="strata-skeleton h-5 w-32 rounded-xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-4 w-20 rounded-lg bg-[var(--strata-bg-elevated)]" />
        </div>
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
      </div>

      {/* Recent Operations Skeleton */}
      <div className="space-y-3 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="strata-skeleton h-5 w-44 rounded-xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-4 w-24 rounded-lg bg-[var(--strata-bg-elevated)]" />
        </div>
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
      </div>
    </div>
  );
}

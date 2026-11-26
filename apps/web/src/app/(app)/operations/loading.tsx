export default function OperationsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="strata-skeleton h-7 w-36 rounded-xl bg-[var(--strata-bg-surface)]" />
          <div className="strata-skeleton h-4 w-64 rounded-lg bg-[var(--strata-bg-surface)]" />
        </div>
        <div className="strata-skeleton h-11 w-36 rounded-2xl bg-[var(--strata-bg-surface)]" />
      </div>

      {/* Period & KPI Card */}
      <div className="space-y-4 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="strata-skeleton h-11 w-52 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-10 w-28 rounded-full bg-[var(--strata-bg-elevated)]" />
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          <div className="strata-skeleton h-20 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-20 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton col-span-2 h-20 rounded-2xl bg-[var(--strata-bg-elevated)] sm:col-span-1" />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="space-y-3 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="strata-skeleton h-11 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-11 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-11 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-11 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        </div>
        <div className="flex gap-2">
          <div className="strata-skeleton h-9 w-16 rounded-full bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-9 w-28 rounded-full bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-9 w-24 rounded-full bg-[var(--strata-bg-elevated)]" />
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

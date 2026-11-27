export default function OperationsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="space-y-2">
        <div className="strata-skeleton h-7 w-36 rounded-xl bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-4 w-64 max-w-full rounded-lg bg-[var(--strata-bg-surface)]" />
      </div>

      {/* Period & KPI Card */}
      <div className="space-y-4 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-5 sm:p-6">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
            <div className="strata-skeleton h-10 w-10 rounded-full bg-[var(--strata-bg-elevated)]" />
            <div className="strata-skeleton h-5 w-32 rounded-full bg-[var(--strata-bg-elevated)]" />
            <div className="strata-skeleton h-10 w-10 rounded-full bg-[var(--strata-bg-elevated)]" />
          </div>
          <div className="strata-skeleton h-10 w-full rounded-full bg-[var(--strata-bg-elevated)] sm:w-32" />
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

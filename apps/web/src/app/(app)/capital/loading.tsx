export default function CapitalLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="strata-skeleton h-7 w-32 rounded-xl bg-[var(--strata-bg-surface)]" />
          <div className="strata-skeleton h-4 w-72 rounded-lg bg-[var(--strata-bg-surface)]" />
        </div>
        <div className="strata-skeleton h-11 w-36 rounded-2xl bg-[var(--strata-bg-surface)]" />
      </div>

      {/* Tabs Switcher */}
      <div className="strata-skeleton h-12 w-full rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
      </div>

      {/* Account Cards */}
      <div className="space-y-3">
        <div className="strata-skeleton h-32 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-32 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-32 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
      </div>
    </div>
  );
}

export default function AppSectionLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="strata-skeleton h-44 rounded-[28px] border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton col-span-2 h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] sm:col-span-1" />
      </div>

      <div className="space-y-3 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-5 sm:p-6">
        <div className="strata-skeleton h-5 w-40 rounded-xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-14 rounded-2xl bg-[var(--strata-bg-elevated)]" />
      </div>
    </div>
  );
}

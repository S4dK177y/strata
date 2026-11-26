export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="strata-skeleton h-7 w-48 rounded-xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-4 w-72 rounded-lg bg-[var(--strata-bg-elevated)]" />
      </div>

      <div className="strata-skeleton h-20 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, idx) => (
          <div
            key={idx}
            className="strata-skeleton h-20 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]"
          />
        ))}
      </div>

      <div className="strata-skeleton h-64 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
      <div className="strata-skeleton h-52 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
    </div>
  );
}

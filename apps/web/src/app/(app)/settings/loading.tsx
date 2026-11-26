export default function SettingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="space-y-2">
        <div className="strata-skeleton h-7 w-48 rounded-xl bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-4 w-72 rounded-lg bg-[var(--strata-bg-surface)]" />
      </div>

      {/* Profile Card */}
      <div className="space-y-4 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-5 sm:p-6">
        <div className="strata-skeleton h-5 w-40 rounded-xl bg-[var(--strata-bg-elevated)]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="strata-skeleton h-11 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-11 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-11 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-11 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        </div>
      </div>

      {/* Preferences Card */}
      <div className="space-y-4 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-5 sm:p-6">
        <div className="strata-skeleton h-5 w-52 rounded-xl bg-[var(--strata-bg-elevated)]" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="strata-skeleton h-11 rounded-xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-11 rounded-xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-11 rounded-xl bg-[var(--strata-bg-elevated)]" />
        </div>
        <div className="strata-skeleton h-16 rounded-2xl bg-[var(--strata-bg-elevated)]" />
      </div>

      {/* Security Card */}
      <div className="strata-skeleton h-24 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
    </div>
  );
}

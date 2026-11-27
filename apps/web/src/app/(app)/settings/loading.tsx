export default function SettingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="space-y-2">
        <div className="strata-skeleton h-7 w-48 rounded-xl bg-[var(--strata-bg-surface)]" />
        <div className="strata-skeleton h-4 w-64 max-w-full rounded-lg bg-[var(--strata-bg-surface)]" />
      </div>

      {/* Profile Card */}
      <div className="space-y-4 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-5 sm:p-6">
        <div className="strata-skeleton h-5 w-40 rounded-xl bg-[var(--strata-bg-elevated)]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="strata-skeleton h-11 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-11 rounded-2xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-11 rounded-2xl bg-[var(--strata-bg-elevated)] sm:col-span-2" />
        </div>
      </div>

      {/* Preferences Card */}
      <div className="space-y-4 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-5 sm:p-6">
        <div className="strata-skeleton h-5 w-52 rounded-xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-11 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="strata-skeleton h-11 rounded-xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-11 rounded-xl bg-[var(--strata-bg-elevated)]" />
          <div className="strata-skeleton h-11 rounded-xl bg-[var(--strata-bg-elevated)]" />
        </div>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          <div className="strata-skeleton h-16 rounded-2xl bg-[var(--strata-bg-elevated)] sm:h-11 sm:rounded-full" />
          <div className="strata-skeleton h-16 rounded-2xl bg-[var(--strata-bg-elevated)] sm:h-11 sm:rounded-full" />
          <div className="strata-skeleton h-16 rounded-2xl bg-[var(--strata-bg-elevated)] sm:h-11 sm:rounded-full" />
          <div className="strata-skeleton h-16 rounded-2xl bg-[var(--strata-bg-elevated)] sm:h-11 sm:rounded-full" />
          <div className="strata-skeleton h-16 rounded-2xl bg-[var(--strata-bg-elevated)] sm:h-11 sm:rounded-full" />
        </div>
        <div className="strata-skeleton h-16 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-11 w-full rounded-full bg-[var(--strata-bg-elevated)]" />
      </div>

      {/* Data Export Card */}
      <div className="grid grid-cols-1 gap-3 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-5 sm:grid-cols-2 sm:p-6">
        <div className="strata-skeleton h-32 rounded-2xl bg-[var(--strata-bg-elevated)]" />
        <div className="strata-skeleton h-32 rounded-2xl bg-[var(--strata-bg-elevated)]" />
      </div>

      {/* Security & Sessions Cards */}
      <div className="strata-skeleton h-28 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
      <div className="strata-skeleton h-36 rounded-3xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]" />
    </div>
  );
}

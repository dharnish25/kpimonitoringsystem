import { useStore } from '@tanstack/react-store'
import { Activity, Pause, Play, RefreshCw, WifiOff } from 'lucide-react'
import { AlertsPanel } from '@/components/AlertsPanel'
import { ChartSection } from '@/components/ChartSection'
import { ComparisonTable } from '@/components/ComparisonTable'
import { KpiCard } from '@/components/KpiCard'
import { retryLoad, useLiveKpis } from '@/hooks/useLiveKpis'
import type { KpiStatus } from '@/lib/kpis'
import { kpiActions, kpiStore, type CompareTo } from '@/store/kpiStore'

const INTERVALS = [
  { ms: 3_000, label: 'Every 3s' },
  { ms: 6_000, label: 'Every 6s' },
  { ms: 15_000, label: 'Every 15s' },
]

export function Dashboard() {
  useLiveKpis()
  const loading = useStore(kpiStore, (s) => s.loading)
  const error = useStore(kpiStore, (s) => s.error)
  const kpis = useStore(kpiStore, (s) => s.kpis)

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        {kpis.length === 0 ? (
          loading ? (
            <LoadingState />
          ) : (
            <ErrorState message={error ?? 'Unable to load KPIs'} />
          )
        ) : (
          <>
            <Overview />
            {error && (
              <div className="mb-6 flex items-center gap-2 rounded-xl bg-warning/15 px-4 py-3 text-sm font-medium text-warning-ink ring-1 ring-warning/40">
                <WifiOff className="h-4 w-4" aria-hidden /> {error}
              </div>
            )}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {kpis.map((kpi) => (
                <KpiCard key={kpi.id} kpi={kpi} />
              ))}
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ChartSection />
              </div>
              <AlertsPanel />
            </div>
            <div className="mt-6">
              <ComparisonTable />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function TopBar() {
  const paused = useStore(kpiStore, (s) => s.paused)
  const intervalMs = useStore(kpiStore, (s) => s.intervalMs)
  const lastUpdated = useStore(kpiStore, (s) => s.lastUpdated)
  const compareTo = useStore(kpiStore, (s) => s.compareTo)
  const hasError = useStore(kpiStore, (s) => s.error !== null)

  const state = paused ? 'Paused' : hasError ? 'Reconnecting' : 'Live'

  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-sm">
            <Activity className="h-5 w-5" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-base font-bold tracking-tight text-ink">Ila</p>
            <p className="text-xs text-ink-2">KPI Monitoring System</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
              state === 'Live'
                ? 'bg-good/10 text-good-ink ring-good/30'
                : state === 'Paused'
                  ? 'bg-page text-ink-2 ring-hairline'
                  : 'bg-warning/15 text-warning-ink ring-warning/40'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${state === 'Live' ? 'live-dot bg-good' : state === 'Paused' ? 'bg-muted' : 'bg-warning'}`}
            />
            {state}
            {lastUpdated && (
              <span className="font-normal tabular">
                · {new Date(lastUpdated).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </span>

          <select
            aria-label="Compare against"
            value={compareTo}
            onChange={(e) => kpiActions.setCompareTo(e.target.value as CompareTo)}
            className="rounded-lg bg-surface px-2.5 py-1.5 text-sm text-ink ring-1 ring-axis"
          >
            <option value="previousDay">vs yesterday</option>
            <option value="previousWeek">vs last week</option>
          </select>

          <select
            aria-label="Refresh interval"
            value={intervalMs}
            onChange={(e) => kpiActions.setIntervalMs(Number(e.target.value))}
            className="rounded-lg bg-surface px-2.5 py-1.5 text-sm text-ink ring-1 ring-axis"
          >
            {INTERVALS.map((i) => (
              <option key={i.ms} value={i.ms}>
                {i.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={kpiActions.togglePaused}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand/90"
          >
            {paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
    </header>
  )
}

function Overview() {
  const statuses = useStore(kpiStore, (s) => s.statuses)
  const total = useStore(kpiStore, (s) => s.kpis.length)
  const counts: Record<KpiStatus, number> = { good: 0, warning: 0, critical: 0 }
  for (const st of Object.values(statuses)) counts[st]++
  const health = total ? Math.round(((counts.good + counts.warning * 0.5) / total) * 100) : 0

  const headline =
    counts.critical > 0
      ? `${counts.critical} KPI${counts.critical > 1 ? 's need' : ' needs'} attention now`
      : counts.warning > 0
        ? `${counts.warning} KPI${counts.warning > 1 ? 's are' : ' is'} close to a threshold`
        : 'All KPIs are on track'

  return (
    <section className="mb-6 flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="text-sm font-medium text-ink-2">Operations overview</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{headline}</h1>
      </div>
      <dl className="flex gap-2 text-sm">
        <Stat label="Health score" value={`${health}`} suffix="/100" />
        <Stat label="On track" value={`${counts.good}`} dot="bg-good" />
        <Stat label="Warning" value={`${counts.warning}`} dot="bg-warning" />
        <Stat label="Critical" value={`${counts.critical}`} dot="bg-critical" />
      </dl>
    </section>
  )
}

function Stat({ label, value, suffix, dot }: { label: string; value: string; suffix?: string; dot?: string }) {
  return (
    <div className="min-w-[88px] rounded-xl bg-surface px-4 py-2.5 ring-1 ring-hairline">
      <dt className="flex items-center gap-1.5 text-xs text-ink-2">
        {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
        {label}
      </dt>
      <dd className="mt-0.5 text-xl font-semibold text-ink">
        {value}
        {suffix && <span className="text-sm font-normal text-muted">{suffix}</span>}
      </dd>
    </div>
  )
}

function LoadingState() {
  return (
    <div aria-busy="true" aria-label="Loading KPIs">
      <div className="mb-6 h-9 w-72 animate-pulse rounded-lg bg-grid" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-52 animate-pulse rounded-2xl bg-surface ring-1 ring-hairline" />
        ))}
      </div>
      <div className="mt-6 h-96 animate-pulse rounded-2xl bg-surface ring-1 ring-hairline" />
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl bg-surface p-8 text-center ring-1 ring-hairline">
      <WifiOff className="mx-auto h-8 w-8 text-critical" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold text-ink">We couldn't reach the KPI feed</h1>
      <p className="mt-1 text-sm text-ink-2">{message}</p>
      <button
        onClick={retryLoad}
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
      >
        <RefreshCw className="h-4 w-4" aria-hidden /> Try again
      </button>
    </div>
  )
}

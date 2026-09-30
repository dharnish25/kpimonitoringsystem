import { AlertTriangle, BellOff, CheckCircle2, OctagonAlert } from 'lucide-react'
import { useStore } from '@tanstack/react-store'
import { formatValue } from '@/lib/kpis'
import { kpiActions, kpiStore, type AlertKind } from '@/store/kpiStore'

const kindStyle: Record<AlertKind, { Icon: typeof CheckCircle2; className: string; verb: string }> = {
  critical: { Icon: OctagonAlert, className: 'text-critical-ink bg-critical/10', verb: 'crossed critical' },
  warning: { Icon: AlertTriangle, className: 'text-warning-ink bg-warning/15', verb: 'crossed warning' },
  recovered: { Icon: CheckCircle2, className: 'text-good-ink bg-good/10', verb: 'back on track' },
}

export function AlertsPanel() {
  const alerts = useStore(kpiStore, (s) => s.alerts)
  const kpis = useStore(kpiStore, (s) => s.kpis)
  const unread = alerts.filter((a) => !a.acknowledged).length
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <section className="flex flex-col rounded-2xl bg-surface ring-1 ring-hairline" aria-labelledby="alerts-title">
      <header className="flex items-center justify-between gap-2 border-b border-hairline px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 id="alerts-title" className="text-base font-semibold text-ink">
            Threshold alerts
          </h2>
          {unread > 0 && (
            <span className="rounded-full bg-critical px-2 py-0.5 text-xs font-semibold text-white tabular">
              {unread} new
            </span>
          )}
        </div>
        {alerts.length > 0 && (
          <div className="flex gap-3 text-xs font-medium">
            {unread > 0 && (
              <button onClick={kpiActions.acknowledgeAll} className="text-series-1 hover:underline">
                Mark all read
              </button>
            )}
            <button onClick={kpiActions.clearAlerts} className="text-ink-2 hover:text-ink hover:underline">
              Clear
            </button>
          </div>
        )}
      </header>

      {alerts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <BellOff className="h-6 w-6 text-muted" aria-hidden />
          <p className="text-sm font-medium text-ink">No alerts right now</p>
          <p className="text-xs text-ink-2">You'll see a notice here the moment a KPI crosses a threshold.</p>
        </div>
      ) : (
        <ul className="max-h-[34rem] divide-y divide-hairline overflow-y-auto">
          {alerts.map((alert) => {
            const kpi = kpis.find((k) => k.id === alert.kpiId)
            if (!kpi) return null
            const { Icon, className, verb } = kindStyle[alert.kind]
            return (
              <li key={alert.id}>
                <button
                  onClick={() => kpiActions.selectKpi(kpi.id)}
                  className={`flex w-full gap-3 px-5 py-3 text-left transition hover:bg-page ${
                    alert.acknowledged ? '' : 'bg-series-1/[0.04]'
                  }`}
                >
                  <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${className}`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{kpi.name}</span>
                      <span className="shrink-0 text-[11px] text-muted tabular">{timeFmt.format(alert.t)}</span>
                    </span>
                    <span className="block text-xs text-ink-2">
                      {alert.kind === 'recovered'
                        ? `${verb} at ${formatValue(kpi, alert.value)}`
                        : `${formatValue(kpi, alert.value)} — ${verb} (${formatValue(kpi, alert.threshold)})`}
                    </span>
                  </span>
                  {!alert.acknowledged && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-series-1" aria-label="Unread" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

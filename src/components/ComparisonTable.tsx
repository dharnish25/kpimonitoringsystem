import { useStore } from '@tanstack/react-store'
import { changeVsBaseline, formatValue, type KpiDefinition } from '@/lib/kpis'
import { kpiActions, kpiStore } from '@/store/kpiStore'
import { StatusBadge } from './StatusBadge'

function Delta({ kpi, value, baseline }: { kpi: KpiDefinition; value: number; baseline: number }) {
  const { pct, improving } = changeVsBaseline(kpi, value, baseline)
  return (
    <span className={`font-semibold ${improving ? 'text-good-ink' : 'text-critical-ink'}`}>
      {pct >= 0 ? '+' : '−'}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

/** Historical comparison: every KPI now vs. the same moment yesterday and last week. */
export function ComparisonTable() {
  const kpis = useStore(kpiStore, (s) => s.kpis)
  const snapshots = useStore(kpiStore, (s) => s.snapshots)
  const statuses = useStore(kpiStore, (s) => s.statuses)
  const selectedId = useStore(kpiStore, (s) => s.selectedId)

  return (
    <section className="rounded-2xl bg-surface ring-1 ring-hairline" aria-labelledby="comparison-title">
      <header className="border-b border-hairline px-5 py-4">
        <h2 id="comparison-title" className="text-base font-semibold text-ink">
          Historical comparison
        </h2>
        <p className="mt-0.5 text-xs text-ink-2">Current reading vs. the same time yesterday and one week ago.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm tabular">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">KPI</th>
              <th className="px-3 py-3 text-right font-medium">Now</th>
              <th className="px-3 py-3 text-right font-medium">Yesterday</th>
              <th className="px-3 py-3 text-right font-medium">Δ day</th>
              <th className="px-3 py-3 text-right font-medium">Last week</th>
              <th className="px-3 py-3 text-right font-medium">Δ week</th>
              <th className="px-5 py-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {kpis.map((kpi) => {
              const snap = snapshots[kpi.id]
              if (!snap) return null
              return (
                <tr
                  key={kpi.id}
                  onClick={() => kpiActions.selectKpi(kpi.id)}
                  className={`cursor-pointer transition hover:bg-page ${selectedId === kpi.id ? 'bg-series-1/[0.05]' : ''}`}
                >
                  <td className="px-5 py-3 font-medium text-ink">{kpi.name}</td>
                  <td className="px-3 py-3 text-right font-semibold text-ink">{formatValue(kpi, snap.value)}</td>
                  <td className="px-3 py-3 text-right text-ink-2">{formatValue(kpi, snap.previousDay)}</td>
                  <td className="px-3 py-3 text-right">
                    <Delta kpi={kpi} value={snap.value} baseline={snap.previousDay} />
                  </td>
                  <td className="px-3 py-3 text-right text-ink-2">{formatValue(kpi, snap.previousWeek)}</td>
                  <td className="px-3 py-3 text-right">
                    <Delta kpi={kpi} value={snap.value} baseline={snap.previousWeek} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <StatusBadge status={statuses[kpi.id] ?? 'good'} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

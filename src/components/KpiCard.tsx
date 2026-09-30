import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useStore } from '@tanstack/react-store'
import { changeVsBaseline, formatValue, type KpiDefinition, type KpiSample } from '@/lib/kpis'
import { kpiActions, kpiStore } from '@/store/kpiStore'
import { ProgressBar } from './ProgressBar'
import { Sparkline } from './Sparkline'
import { StatusBadge } from './StatusBadge'

const NO_SAMPLES: KpiSample[] = []

const statusRing = {
  good: 'ring-hairline',
  warning: 'ring-warning/70',
  critical: 'ring-critical/70',
}

export function KpiCard({ kpi }: { kpi: KpiDefinition }) {
  const snapshot = useStore(kpiStore, (s) => s.snapshots[kpi.id])
  const history = useStore(kpiStore, (s) => s.history[kpi.id] ?? NO_SAMPLES)
  const status = useStore(kpiStore, (s) => s.statuses[kpi.id] ?? 'good')
  const thresholds = useStore(kpiStore, (s) => s.thresholds[kpi.id])
  const selected = useStore(kpiStore, (s) => s.selectedId === kpi.id)
  const compareTo = useStore(kpiStore, (s) => s.compareTo)

  if (!snapshot || !thresholds) return null

  const baseline = snapshot[compareTo]
  const change = changeVsBaseline(kpi, snapshot.value, baseline)
  const Arrow = change.pct >= 0 ? ArrowUpRight : ArrowDownRight

  return (
    <button
      type="button"
      onClick={() => kpiActions.selectKpi(kpi.id)}
      aria-pressed={selected}
      className={`group flex flex-col gap-4 rounded-2xl bg-surface p-5 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-series-1 ${
        selected ? 'shadow-md ring-2 ring-series-1' : statusRing[status]
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-2">{kpi.name}</p>
          <p
            key={snapshot.value}
            className="value-flash -mx-1 mt-1 rounded px-1 text-3xl font-semibold tracking-tight text-ink tabular"
          >
            {formatValue(kpi, snapshot.value)}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="text-xs">
          <span
            className={`inline-flex items-center gap-0.5 font-semibold tabular ${
              change.improving ? 'text-good-ink' : 'text-critical-ink'
            }`}
          >
            <Arrow className="h-3.5 w-3.5" aria-hidden />
            {Math.abs(change.pct).toFixed(1)}%
          </span>
          <span className="ml-1 text-muted">
            vs {compareTo === 'previousDay' ? 'yesterday' : 'last week'} (
            {formatValue(kpi, baseline, true)})
          </span>
        </div>
        <Sparkline samples={history} />
      </div>

      <ProgressBar kpi={kpi} value={snapshot.value} status={status} thresholds={thresholds} />
    </button>
  )
}

import type { KpiDefinition, KpiStatus, Thresholds } from '@/lib/kpis'
import { formatValue } from '@/lib/kpis'

const fill: Record<KpiStatus, string> = {
  good: 'bg-good',
  warning: 'bg-warning',
  critical: 'bg-critical',
}

interface ProgressBarProps {
  kpi: KpiDefinition
  value: number
  status: KpiStatus
  thresholds: Thresholds
}

/**
 * Shows where the current value sits on the KPI's scale, with tick marks
 * for the warning and critical thresholds and the target.
 */
export function ProgressBar({ kpi, value, status, thresholds }: ProgressBarProps) {
  const pos = (v: number) =>
    Math.min(100, Math.max(0, ((v - kpi.min) / (kpi.max - kpi.min)) * 100))

  const progress =
    kpi.direction === 'higher'
      ? Math.min(100, (value / kpi.target) * 100)
      : Math.min(100, (kpi.target / Math.max(value, 0.0001)) * 100)

  return (
    <div>
      <div
        className="relative h-2 rounded-full bg-grid/70"
        role="meter"
        aria-valuemin={kpi.min}
        aria-valuemax={kpi.max}
        aria-valuenow={value}
        aria-label={`${kpi.name}: ${formatValue(kpi, value)}`}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out ${fill[status]}`}
          style={{ width: `${pos(value)}%` }}
        />
        <Tick at={pos(thresholds.warning)} className="bg-warning-ink" label="Warning threshold" />
        <Tick at={pos(thresholds.critical)} className="bg-critical-ink" label="Critical threshold" />
        <Tick at={pos(kpi.target)} className="bg-ink" label="Target" tall />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted tabular">
        <span>{Math.round(progress)}% of target</span>
        <span>
          Target {kpi.direction === 'higher' ? '≥' : '≤'} {formatValue(kpi, kpi.target, true)}
        </span>
      </div>
    </div>
  )
}

function Tick({ at, className, label, tall }: { at: number; className: string; label: string; tall?: boolean }) {
  return (
    <span
      title={label}
      className={`absolute w-0.5 rounded-full ring-2 ring-surface ${className} ${tall ? '-top-1 h-4' : '-top-0.5 h-3'}`}
      style={{ left: `calc(${at}% - 1px)` }}
    />
  )
}

import { useState } from 'react'
import { useStore } from '@tanstack/react-store'
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { RotateCcw } from 'lucide-react'
import { formatValue, type KpiDefinition, type KpiSample } from '@/lib/kpis'
import { kpiActions, kpiStore } from '@/store/kpiStore'
import { StatusBadge } from './StatusBadge'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler)

const C = {
  series1: '#2a78d6',
  series2: '#eb6834',
  ink: '#0b0b0b',
  ink2: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  warning: '#c98500',
  critical: '#d03b3b',
  surface: '#fcfcfb',
}

type View = 'live' | 'history'

const NO_SAMPLES: KpiSample[] = []

function baseOptions(kpi: KpiDefinition): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: { color: C.ink2, usePointStyle: true, pointStyle: 'line', boxWidth: 24, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: C.ink,
        bodyColor: C.ink2,
        borderColor: 'rgba(11,11,11,0.1)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${formatValue(kpi, ctx.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: '#c3c2b7' },
        ticks: { color: C.muted, maxTicksLimit: 8, maxRotation: 0, font: { size: 11 } },
      },
      y: {
        grid: { color: C.grid },
        border: { display: false },
        ticks: {
          color: C.muted,
          maxTicksLimit: 6,
          font: { size: 11 },
          callback: (v) => formatValue(kpi, Number(v), true),
        },
      },
    },
  }
}

function refLine(label: string, value: number, length: number, color: string, dash: number[]) {
  return {
    label,
    data: Array(length).fill(value),
    borderColor: color,
    borderWidth: 1.5,
    borderDash: dash,
    pointRadius: 0,
    pointHoverRadius: 0,
    fill: false,
  }
}

export function ChartSection() {
  const [view, setView] = useState<View>('live')
  const kpi = useStore(kpiStore, (s) => s.kpis.find((k) => k.id === s.selectedId))
  const history = useStore(kpiStore, (s) => s.history[s.selectedId] ?? NO_SAMPLES)
  const comparison = useStore(kpiStore, (s) => s.comparison)
  const thresholds = useStore(kpiStore, (s) => s.thresholds[s.selectedId])
  const status = useStore(kpiStore, (s) => s.statuses[s.selectedId] ?? 'good')
  const snapshot = useStore(kpiStore, (s) => s.snapshots[s.selectedId])

  if (!kpi || !thresholds || !snapshot) return null

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const hourFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })

  const liveData = {
    labels: history.map((p) => timeFmt.format(p.t)),
    datasets: [
      {
        label: kpi.name,
        data: history.map((p) => p.value),
        borderColor: C.series1,
        backgroundColor: 'rgba(42,120,214,0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBorderColor: C.surface,
        pointHoverBorderWidth: 2,
        pointBackgroundColor: C.series1,
      },
      refLine('Target', kpi.target, history.length, C.ink2, [2, 3]),
      refLine('Warning', thresholds.warning, history.length, C.warning, [6, 4]),
      refLine('Critical', thresholds.critical, history.length, C.critical, [6, 4]),
    ],
  }

  const series = comparison?.series[kpi.id]
  const historyData = comparison && series && {
    labels: comparison.hours.map((h) => hourFmt.format(h)),
    datasets: [
      {
        label: 'Last 24 hours',
        data: series.current,
        borderColor: C.series1,
        backgroundColor: C.series1,
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
      {
        label: 'Previous 24 hours',
        data: series.previous,
        borderColor: C.series2,
        backgroundColor: C.series2,
        borderWidth: 2,
        borderDash: [5, 4],
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
    ],
  }

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)

  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-hairline sm:p-6" aria-labelledby="chart-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="chart-title" className="text-lg font-semibold text-ink">
              {kpi.name}
            </h2>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 max-w-xl text-sm text-ink-2">{kpi.description}</p>
        </div>
        <div className="inline-flex rounded-lg bg-page p-1 ring-1 ring-hairline" role="tablist">
          {(
            [
              ['live', 'Live trend'],
              ['history', '24h comparison'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                view === id ? 'bg-surface text-ink shadow-sm ring-1 ring-hairline' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 h-72">
        {view === 'live' ? (
          <Line data={liveData} options={baseOptions(kpi)} />
        ) : historyData ? (
          <Line data={historyData} options={baseOptions(kpi)} />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted">Loading history…</div>
        )}
      </div>

      {view === 'history' && series && (
        <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-page p-4 text-sm">
          <div>
            <dt className="text-muted">Avg. last 24h</dt>
            <dd className="mt-0.5 font-semibold text-ink tabular">{formatValue(kpi, avg(series.current))}</dd>
          </div>
          <div>
            <dt className="text-muted">Avg. previous 24h</dt>
            <dd className="mt-0.5 font-semibold text-ink tabular">{formatValue(kpi, avg(series.previous))}</dd>
          </div>
          <div>
            <dt className="text-muted">Change</dt>
            <dd className="mt-0.5 font-semibold text-ink tabular">
              {(((avg(series.current) - avg(series.previous)) / (avg(series.previous) || 1)) * 100).toFixed(1)}%
            </dd>
          </div>
        </dl>
      )}

      <ThresholdEditor kpi={kpi} />
    </section>
  )
}

function ThresholdEditor({ kpi }: { kpi: KpiDefinition }) {
  const thresholds = useStore(kpiStore, (s) => s.thresholds[kpi.id])
  if (!thresholds) return null

  const step = kpi.decimals === 0 ? (kpi.max > 1000 ? 100 : 5) : 1 / 10 ** kpi.decimals
  const comparator = kpi.direction === 'higher' ? 'below' : 'above'
  const isDefault = thresholds.warning === kpi.warning && thresholds.critical === kpi.critical
  const invalid =
    kpi.direction === 'higher'
      ? thresholds.critical > thresholds.warning
      : thresholds.critical < thresholds.warning

  const update = (key: 'warning' | 'critical', raw: string) => {
    const value = Number(raw)
    if (Number.isFinite(value)) kpiActions.setThresholds(kpi.id, { ...thresholds, [key]: value })
  }

  return (
    <div className="mt-5 border-t border-hairline pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Threshold alerts</h3>
        {!isDefault && (
          <button
            type="button"
            onClick={() => kpiActions.resetThresholds(kpi.id)}
            className="inline-flex items-center gap-1 text-xs font-medium text-series-1 hover:underline"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset to defaults
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-2">
        Get alerted when {kpi.name.toLowerCase()} {kpi.direction === 'higher' ? 'drops below' : 'rises above'} these levels.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {(['warning', 'critical'] as const).map((key) => (
          <label key={key} className="block">
            <span className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
              <span className={`h-2 w-2 rounded-full ${key === 'warning' ? 'bg-warning' : 'bg-critical'}`} />
              {key === 'warning' ? 'Warning' : 'Critical'} {comparator}
            </span>
            <div className="mt-1 flex items-center rounded-lg bg-surface ring-1 ring-axis focus-within:ring-2 focus-within:ring-series-1">
              <input
                type="number"
                step={step}
                value={thresholds[key]}
                onChange={(e) => update(key, e.target.value)}
                className="w-full rounded-lg bg-transparent px-3 py-2 text-sm text-ink tabular outline-none"
              />
              {kpi.unit && kpi.format !== 'currency' && (
                <span className="pr-3 text-xs text-muted">{kpi.unit}</span>
              )}
            </div>
          </label>
        ))}
      </div>
      {invalid && (
        <p className="mt-2 text-xs font-medium text-critical-ink">
          The critical level should be {kpi.direction === 'higher' ? 'lower' : 'higher'} than the warning level.
        </p>
      )}
    </div>
  )
}

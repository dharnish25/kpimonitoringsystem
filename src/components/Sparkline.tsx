import type { KpiSample } from '@/lib/kpis'

/** Tiny inline trend line for KPI cards — no axes, one series. */
export function Sparkline({ samples, width = 120, height = 36 }: { samples: KpiSample[]; width?: number; height?: number }) {
  if (samples.length < 2) return <div style={{ width, height }} />
  const values = samples.map((s) => s.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pad = 3
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = pad + (1 - (v - min) / range) * (height - pad * 2)
    return [x, y] as const
  })
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={`${d} L${width},${height} L0,${height} Z`} className="fill-series-1/10" />
      <path d={d} className="fill-none stroke-series-1" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={3.5} className="fill-series-1 stroke-surface" strokeWidth={2} />
    </svg>
  )
}

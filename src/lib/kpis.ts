// Shared KPI definitions and the deterministic signal generator behind the API.
// Every value is a pure function of (kpi, timestamp), so the server stays
// stateless: /api/kpis and /api/kpis/live always agree, and "24h ago" or
// "7 days ago" can be computed for historical comparison without storage.

export type Direction = 'higher' | 'lower'
export type KpiStatus = 'good' | 'warning' | 'critical'
export type KpiFormat = 'currency' | 'percent' | 'number' | 'ms'

export interface KpiDefinition {
  id: string
  name: string
  description: string
  format: KpiFormat
  unit: string
  decimals: number
  direction: Direction
  target: number
  warning: number
  critical: number
  /** Scale used by the progress bar. */
  min: number
  max: number
}

interface SignalShape {
  base: number
  amplitude: number
  noise: number
  incident: number
  phase: number
  seed: number
}

export interface Thresholds {
  warning: number
  critical: number
}

export interface KpiSample {
  t: number
  value: number
}

export interface KpiSnapshot {
  id: string
  value: number
  previousDay: number
  previousWeek: number
}

export interface KpisResponse {
  generatedAt: number
  tickMs: number
  kpis: KpiDefinition[]
  snapshots: KpiSnapshot[]
  history: Record<string, KpiSample[]>
  comparison: {
    hours: number[]
    series: Record<string, { current: number[]; previous: number[] }>
  }
}

export interface LiveResponse {
  t: number
  snapshots: KpiSnapshot[]
}

export const TICK_MS = 3_000
export const HISTORY_POINTS = 40
const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const INCIDENT_WINDOW_MS = 45_000

const catalog: Array<KpiDefinition & { signal: SignalShape }> = [
  {
    id: 'revenue',
    name: 'Revenue per hour',
    description: 'Gross sales booked across all channels in the last hour.',
    format: 'currency',
    unit: '$',
    decimals: 0,
    direction: 'higher',
    target: 48_000,
    warning: 40_000,
    critical: 34_000,
    min: 0,
    max: 60_000,
    signal: { base: 45_000, amplitude: 5_500, noise: 1_600, incident: 11_000, phase: 0.4, seed: 11 },
  },
  {
    id: 'csat',
    name: 'Customer satisfaction',
    description: 'Share of post-interaction surveys rated 4 or 5 stars.',
    format: 'percent',
    unit: '%',
    decimals: 1,
    direction: 'higher',
    target: 92,
    warning: 88,
    critical: 84,
    min: 70,
    max: 100,
    signal: { base: 91.5, amplitude: 2.2, noise: 0.9, incident: 6.5, phase: 1.7, seed: 23 },
  },
  {
    id: 'fulfillment',
    name: 'Order fulfillment',
    description: 'Orders shipped within the promised dispatch window.',
    format: 'percent',
    unit: '%',
    decimals: 1,
    direction: 'higher',
    target: 97,
    warning: 94,
    critical: 90,
    min: 80,
    max: 100,
    signal: { base: 96.4, amplitude: 1.4, noise: 0.6, incident: 5.5, phase: 2.9, seed: 37 },
  },
  {
    id: 'active-users',
    name: 'Active users',
    description: 'Unique users with a session in the last five minutes.',
    format: 'number',
    unit: '',
    decimals: 0,
    direction: 'higher',
    target: 5_200,
    warning: 4_200,
    critical: 3_500,
    min: 0,
    max: 7_000,
    signal: { base: 4_900, amplitude: 1_100, noise: 180, incident: 1_500, phase: 4.1, seed: 41 },
  },
  {
    id: 'response-time',
    name: 'API response time',
    description: 'p95 latency of customer-facing API requests.',
    format: 'ms',
    unit: 'ms',
    decimals: 0,
    direction: 'lower',
    target: 180,
    warning: 240,
    critical: 300,
    min: 0,
    max: 400,
    signal: { base: 190, amplitude: 28, noise: 14, incident: 120, phase: 0.9, seed: 53 },
  },
  {
    id: 'error-rate',
    name: 'Error rate',
    description: 'Share of requests returning a 5xx response.',
    format: 'percent',
    unit: '%',
    decimals: 2,
    direction: 'lower',
    target: 0.5,
    warning: 1.2,
    critical: 2,
    min: 0,
    max: 3,
    signal: { base: 0.6, amplitude: 0.25, noise: 0.12, incident: 1.6, phase: 3.3, seed: 67 },
  },
]

export const KPI_DEFINITIONS: KpiDefinition[] = catalog.map(({ signal: _signal, ...def }) => def)

function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

export function sampleValue(id: string, t: number): number {
  const kpi = catalog.find((k) => k.id === id)
  if (!kpi) throw new Error(`Unknown KPI: ${id}`)
  const { signal } = kpi

  const tick = Math.floor(t / TICK_MS)
  const daily = Math.sin((2 * Math.PI * t) / DAY_MS + signal.phase) * signal.amplitude
  const jitter = (hash(tick * 31 + signal.seed) - 0.5) * 2 * signal.noise

  // Occasional incidents push the KPI in its "bad" direction for ~45s,
  // which is what drives threshold alerts on the dashboard.
  const incidentWindow = Math.floor(t / INCIDENT_WINDOW_MS)
  const inIncident = hash(incidentWindow * 17 + signal.seed * 3) < 0.14
  const severity = 0.55 + hash(incidentWindow * 5 + signal.seed) * 0.6
  const badSign = kpi.direction === 'higher' ? -1 : 1
  const incident = inIncident ? badSign * signal.incident * severity : 0

  const raw = signal.base + daily + jitter + incident
  return round(Math.min(kpi.max, Math.max(kpi.min, raw)), kpi.decimals)
}

export function snapshotAt(t: number): KpiSnapshot[] {
  return KPI_DEFINITIONS.map((def) => ({
    id: def.id,
    value: sampleValue(def.id, t),
    previousDay: sampleValue(def.id, t - DAY_MS),
    previousWeek: sampleValue(def.id, t - 7 * DAY_MS),
  }))
}

export function buildKpisResponse(now = Date.now()): KpisResponse {
  const t = Math.floor(now / TICK_MS) * TICK_MS

  const history: Record<string, KpiSample[]> = {}
  for (const def of KPI_DEFINITIONS) {
    history[def.id] = Array.from({ length: HISTORY_POINTS }, (_, i) => {
      const ts = t - (HISTORY_POINTS - 1 - i) * TICK_MS
      return { t: ts, value: sampleValue(def.id, ts) }
    })
  }

  // Hourly readings for the last 24 hours vs. the same hours one day earlier.
  const currentHour = Math.floor(t / HOUR_MS) * HOUR_MS
  const hours = Array.from({ length: 24 }, (_, i) => currentHour - (23 - i) * HOUR_MS)
  const series: KpisResponse['comparison']['series'] = {}
  for (const def of KPI_DEFINITIONS) {
    series[def.id] = {
      current: hours.map((h) => hourlyAverage(def.id, h)),
      previous: hours.map((h) => hourlyAverage(def.id, h - DAY_MS)),
    }
  }

  return {
    generatedAt: t,
    tickMs: TICK_MS,
    kpis: KPI_DEFINITIONS,
    snapshots: snapshotAt(t),
    history,
    comparison: { hours, series },
  }
}

function hourlyAverage(id: string, hourStart: number): number {
  const def = KPI_DEFINITIONS.find((k) => k.id === id)!
  const samples = 12
  let sum = 0
  for (let i = 0; i < samples; i++) {
    sum += sampleValue(id, hourStart + (i * HOUR_MS) / samples)
  }
  return round(sum / samples, def.decimals)
}

export function buildLiveResponse(now = Date.now()): LiveResponse {
  const t = Math.floor(now / TICK_MS) * TICK_MS
  return { t, snapshots: snapshotAt(t) }
}

export function getStatus(def: KpiDefinition, value: number, thresholds: Thresholds): KpiStatus {
  if (def.direction === 'higher') {
    if (value < thresholds.critical) return 'critical'
    if (value < thresholds.warning) return 'warning'
    return 'good'
  }
  if (value > thresholds.critical) return 'critical'
  if (value > thresholds.warning) return 'warning'
  return 'good'
}

export function formatValue(def: KpiDefinition, value: number, compact = false): string {
  switch (def.format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: compact ? 1 : def.decimals,
        notation: compact ? 'compact' : 'standard',
      }).format(value)
    case 'percent':
      return `${value.toFixed(def.decimals)}%`
    case 'ms':
      return `${Math.round(value)} ms`
    default:
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: compact ? 1 : def.decimals,
        notation: compact ? 'compact' : 'standard',
      }).format(value)
  }
}

/** Relative change, signed so that positive always means "better". */
export function changeVsBaseline(def: KpiDefinition, value: number, baseline: number) {
  const raw = baseline === 0 ? 0 : ((value - baseline) / Math.abs(baseline)) * 100
  const improving = def.direction === 'higher' ? raw >= 0 : raw <= 0
  return { pct: raw, improving }
}

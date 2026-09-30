import { Store } from '@tanstack/react-store'
import {
  getStatus,
  HISTORY_POINTS,
  type KpiDefinition,
  type KpiSample,
  type KpiSnapshot,
  type KpisResponse,
  type KpiStatus,
  type LiveResponse,
  type Thresholds,
} from '@/lib/kpis'

export type AlertKind = 'warning' | 'critical' | 'recovered'
export type CompareTo = 'previousDay' | 'previousWeek'

export interface KpiAlert {
  id: string
  kpiId: string
  kind: AlertKind
  value: number
  threshold: number
  t: number
  acknowledged: boolean
}

export interface KpiState {
  loading: boolean
  error: string | null
  kpis: KpiDefinition[]
  snapshots: Record<string, KpiSnapshot>
  history: Record<string, KpiSample[]>
  comparison: KpisResponse['comparison'] | null
  thresholds: Record<string, Thresholds>
  statuses: Record<string, KpiStatus>
  alerts: KpiAlert[]
  selectedId: string
  paused: boolean
  intervalMs: number
  compareTo: CompareTo
  lastUpdated: number | null
  tickMs: number
}

const THRESHOLDS_KEY = 'ila-kpi-thresholds'
const MAX_ALERTS = 50

export const kpiStore = new Store<KpiState>({
  loading: true,
  error: null,
  kpis: [],
  snapshots: {},
  history: {},
  comparison: null,
  thresholds: {},
  statuses: {},
  alerts: [],
  selectedId: 'revenue',
  paused: false,
  intervalMs: 3_000,
  compareTo: 'previousDay',
  lastUpdated: null,
  tickMs: 3_000,
})

function defaultThresholds(kpis: KpiDefinition[]): Record<string, Thresholds> {
  return Object.fromEntries(kpis.map((k) => [k.id, { warning: k.warning, critical: k.critical }]))
}

function loadSavedThresholds(): Record<string, Thresholds> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(THRESHOLDS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveThresholds(thresholds: Record<string, Thresholds>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(thresholds))
}

const rank: Record<KpiStatus, number> = { good: 0, warning: 1, critical: 2 }

/** Compares fresh readings against thresholds and emits alerts on status changes. */
function evaluate(
  state: KpiState,
  snapshots: KpiSnapshot[],
  t: number,
  alertOnInitial: boolean,
): Pick<KpiState, 'statuses' | 'alerts'> {
  const statuses = { ...state.statuses }
  const fresh: KpiAlert[] = []

  for (const snap of snapshots) {
    const def = state.kpis.find((k) => k.id === snap.id)
    const thresholds = state.thresholds[snap.id]
    if (!def || !thresholds) continue

    const next = getStatus(def, snap.value, thresholds)
    const prev = statuses[snap.id]
    statuses[snap.id] = next

    const changed = prev === undefined ? alertOnInitial && next !== 'good' : prev !== next
    if (!changed) continue

    const worsened = prev === undefined || rank[next] > rank[prev]
    const kind: AlertKind = worsened ? (next as AlertKind) : next === 'good' ? 'recovered' : next
    fresh.push({
      id: `${snap.id}-${t}-${kind}`,
      kpiId: snap.id,
      kind,
      value: snap.value,
      threshold: kind === 'critical' ? thresholds.critical : thresholds.warning,
      t,
      acknowledged: kind === 'recovered',
    })
  }

  return { statuses, alerts: [...fresh, ...state.alerts].slice(0, MAX_ALERTS) }
}

export const kpiActions = {
  loadInitial(data: KpisResponse) {
    kpiStore.setState((s) => {
      const thresholds = { ...defaultThresholds(data.kpis), ...loadSavedThresholds() }
      const base: KpiState = {
        ...s,
        loading: false,
        error: null,
        kpis: data.kpis,
        snapshots: Object.fromEntries(data.snapshots.map((snap) => [snap.id, snap])),
        history: data.history,
        comparison: data.comparison,
        thresholds,
        statuses: s.statuses,
        tickMs: data.tickMs,
        intervalMs: s.lastUpdated ? s.intervalMs : data.tickMs,
        lastUpdated: data.generatedAt,
      }
      return { ...base, ...evaluate(base, data.snapshots, data.generatedAt, s.kpis.length === 0) }
    })
  },

  applyLive(data: LiveResponse) {
    kpiStore.setState((s) => {
      if (s.lastUpdated !== null && data.t <= s.lastUpdated) return s
      const history = { ...s.history }
      for (const snap of data.snapshots) {
        const series = history[snap.id] ?? []
        history[snap.id] = [...series, { t: data.t, value: snap.value }].slice(-HISTORY_POINTS)
      }
      return {
        ...s,
        error: null,
        history,
        snapshots: Object.fromEntries(data.snapshots.map((snap) => [snap.id, snap])),
        lastUpdated: data.t,
        ...evaluate(s, data.snapshots, data.t, false),
      }
    })
  },

  setError(message: string | null) {
    kpiStore.setState((s) => ({ ...s, error: message, loading: false }))
  },

  selectKpi(id: string) {
    kpiStore.setState((s) => ({ ...s, selectedId: id }))
  },

  togglePaused() {
    kpiStore.setState((s) => ({ ...s, paused: !s.paused }))
  },

  setIntervalMs(intervalMs: number) {
    kpiStore.setState((s) => ({ ...s, intervalMs }))
  },

  setCompareTo(compareTo: CompareTo) {
    kpiStore.setState((s) => ({ ...s, compareTo }))
  },

  setThresholds(id: string, next: Thresholds) {
    kpiStore.setState((s) => {
      const thresholds = { ...s.thresholds, [id]: next }
      saveThresholds(thresholds)
      const def = s.kpis.find((k) => k.id === id)
      const snap = s.snapshots[id]
      const statuses = { ...s.statuses }
      if (def && snap) statuses[id] = getStatus(def, snap.value, next)
      return { ...s, thresholds, statuses }
    })
  },

  resetThresholds(id: string) {
    const def = kpiStore.state.kpis.find((k) => k.id === id)
    if (def) kpiActions.setThresholds(id, { warning: def.warning, critical: def.critical })
  },

  acknowledgeAll() {
    kpiStore.setState((s) => ({
      ...s,
      alerts: s.alerts.map((a) => ({ ...a, acknowledged: true })),
    }))
  },

  clearAlerts() {
    kpiStore.setState((s) => ({ ...s, alerts: [] }))
  },
}

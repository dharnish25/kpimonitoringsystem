import { useEffect } from 'react'
import { useStore } from '@tanstack/react-store'
import type { KpisResponse, LiveResponse } from '@/lib/kpis'
import { kpiActions, kpiStore } from '@/store/kpiStore'

const COMPARISON_REFRESH_MS = 5 * 60_000

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json() as Promise<T>
}

async function loadAll() {
  try {
    kpiActions.loadInitial(await getJson<KpisResponse>('/api/kpis'))
  } catch (err) {
    kpiActions.setError(err instanceof Error ? err.message : 'Unable to load KPIs')
  }
}

/** Loads GET /api/kpis once, then polls GET /api/kpis/live while not paused. */
export function useLiveKpis() {
  const paused = useStore(kpiStore, (s) => s.paused)
  const intervalMs = useStore(kpiStore, (s) => s.intervalMs)
  const ready = useStore(kpiStore, (s) => s.kpis.length > 0)

  useEffect(() => {
    loadAll()
    const refresh = window.setInterval(loadAll, COMPARISON_REFRESH_MS)
    return () => window.clearInterval(refresh)
  }, [])

  useEffect(() => {
    if (paused || !ready) return
    let cancelled = false
    const poll = async () => {
      try {
        const live = await getJson<LiveResponse>('/api/kpis/live')
        if (!cancelled) kpiActions.applyLive(live)
      } catch {
        if (!cancelled) kpiActions.setError('Live feed interrupted — retrying…')
      }
    }
    poll()
    const id = window.setInterval(poll, intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [paused, intervalMs, ready])
}

export function retryLoad() {
  kpiStore.setState((s) => ({ ...s, loading: true, error: null }))
  loadAll()
}

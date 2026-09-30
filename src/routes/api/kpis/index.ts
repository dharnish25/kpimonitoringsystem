import { createFileRoute } from '@tanstack/react-router'
import { buildKpisResponse } from '@/lib/kpis'

// GET /api/kpis — KPI catalog, current snapshot, recent live history and
// the 24h vs. previous-day hourly comparison.
export const Route = createFileRoute('/api/kpis/')({
  server: {
    handlers: {
      GET: async () =>
        Response.json(buildKpisResponse(), {
          headers: { 'Cache-Control': 'no-store' },
        }),
    },
  },
})

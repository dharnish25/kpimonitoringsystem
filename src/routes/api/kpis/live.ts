import { createFileRoute } from '@tanstack/react-router'
import { buildLiveResponse } from '@/lib/kpis'

// GET /api/kpis/live — the latest reading for every KPI, polled by the dashboard.
export const Route = createFileRoute('/api/kpis/live')({
  server: {
    handlers: {
      GET: async () =>
        Response.json(buildLiveResponse(), {
          headers: { 'Cache-Control': 'no-store' },
        }),
    },
  },
})

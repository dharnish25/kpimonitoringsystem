# AGENTS.md

## Project overview

**Ila KPI Monitoring System** — a single-page ReactJS dashboard that monitors KPIs with live updates, threshold alerts and historical comparison. Built with TanStack Start (React 19) and deployed on Netlify. The original brief is a student project spec: components `KpiCard`, `ProgressBar`, `ChartSection`; page `Dashboard`; APIs `GET /kpis` and `GET /kpis/live` (served here under `/api`).

## Architecture

- `src/lib/kpis.ts` — single source of truth for KPI definitions, the deterministic signal generator (`sampleValue(id, t)`), status evaluation (`getStatus`), formatting and delta helpers. Shared by server routes and UI.
- `src/routes/api/kpis/index.ts` / `live.ts` — TanStack Start server routes returning JSON built from `lib/kpis.ts`.
- `src/store/kpiStore.ts` — TanStack Store holding all app state plus `kpiActions`. Alerts are produced inside the store (`evaluate`) when a KPI's status changes on a live tick.
- `src/hooks/useLiveKpis.ts` — loads `/api/kpis` on mount (and every 5 min), then polls `/api/kpis/live` at `intervalMs` unless paused.
- `src/pages/Dashboard.tsx` — page composition (top bar, overview, cards, chart, alerts, table). `src/routes/index.tsx` just renders it.
- `src/components/` — presentational pieces reading from the store via `useStore(kpiStore, selector)`.

## Non-obvious decisions

- The server is stateless: values are a pure function of time, so "yesterday"/"last week" comparisons and live polling are always consistent without a database. To use real data, replace `sampleValue()`/`buildKpisResponse()`; if persistence becomes necessary, use Netlify Database (see skills).
- User-edited thresholds are a per-browser preference stored in `localStorage` (`ila-kpi-thresholds`).
- Store selectors must return stable references (use module-level empty constants like `NO_SAMPLES`), otherwise `useStore` re-renders endlessly.
- Chart.js only renders client-side; data is fetched in effects, so SSR shows the loading skeleton.
- Colors come from Tailwind `@theme` tokens in `src/styles.css`; status colors (good/warning/critical) are reserved for status and always paired with an icon + label. Chart hex values mirror those tokens in `ChartSection.tsx`.

## Conventions

- TypeScript strict, `@/` alias for `src/`, PascalCase components, camelCase hooks/utilities.
- Tailwind utility classes; numbers use the `.tabular` class where alignment matters.

## Commands

```bash
pnpm dev     # dev server on :3000
pnpm build   # production build (Netlify runs this)
```

import { AlertTriangle, CheckCircle2, OctagonAlert } from 'lucide-react'
import type { KpiStatus } from '@/lib/kpis'

const styles: Record<KpiStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  good: {
    label: 'On track',
    className: 'bg-good/10 text-good-ink ring-good/30',
    Icon: CheckCircle2,
  },
  warning: {
    label: 'Warning',
    className: 'bg-warning/15 text-warning-ink ring-warning/40',
    Icon: AlertTriangle,
  },
  critical: {
    label: 'Critical',
    className: 'bg-critical/10 text-critical-ink ring-critical/30',
    Icon: OctagonAlert,
  },
}

export function StatusBadge({ status }: { status: KpiStatus }) {
  const { label, className, Icon } = styles[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  )
}

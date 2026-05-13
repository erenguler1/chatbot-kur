import type { BotStatus } from '../types/bot'

interface StatusBadgeProps {
  status: BotStatus
}

const STATUS_MAP: Record<BotStatus, { label: string; className: string }> = {
  active: {
    label: 'Aktif',
    className: 'bg-[rgba(16,185,129,0.1)] text-[var(--success)]',
  },
  paused: {
    label: 'Duraklatıldı',
    className: 'bg-[rgba(245,158,11,0.1)] text-[var(--warning)]',
  },
  draft: {
    label: 'Taslak',
    className: 'bg-[var(--bg-app)] text-[var(--text-muted)]',
  },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = STATUS_MAP[status]
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${className}`}
    >
      <span aria-hidden="true">●</span>
      {label}
    </span>
  )
}

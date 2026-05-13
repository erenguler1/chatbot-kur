import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 p-[60px] text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--bg-app)] flex items-center justify-center text-[var(--text-muted)]">
        {icon}
      </div>
      <h3 className="text-[15px] font-medium text-[var(--text)]">{title}</h3>
      <p className="text-[12px] text-[var(--text-muted)]">{description}</p>
    </div>
  )
}

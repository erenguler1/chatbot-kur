interface SkeletonProps {
  width?: string
  height?: string
  className?: string
}

export function Skeleton({
  width = '',
  height = '',
  className = '',
}: SkeletonProps) {
  return (
    <div
      className={`bg-[var(--bg-app)] animate-pulse rounded ${width} ${height} ${className}`.trim()}
    />
  )
}

interface BotAvatarProps {
  name: string
  size?: number
}

export function BotAvatar({ name, size = 32 }: BotAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div
      className="rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0 font-semibold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initial}
    </div>
  )
}

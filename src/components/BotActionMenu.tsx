import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreVertical, Edit3, Copy, Trash2 } from 'lucide-react'

interface BotActionMenuProps {
  botId: string
  onEdit?: () => void
  onCopy?: () => void
  onDelete?: () => void
}

const ITEM_CLASS =
  'flex items-center gap-2 px-3 py-2 rounded text-sm text-[var(--text)] outline-none cursor-pointer transition-colors data-[highlighted]:bg-[var(--bg-app)] data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed'

export function BotActionMenu({
  botId,
  onEdit,
  onCopy,
  onDelete,
}: BotActionMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          data-bot-id={botId}
          aria-label="Bot işlemleri"
          className="w-[30px] h-[30px] rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--text)] transition-colors outline-none"
        >
          <MoreVertical size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="w-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-card)] shadow-lg p-1 z-50"
        >
          <DropdownMenu.Item
            disabled={!onEdit}
            onSelect={() => onEdit?.()}
            className={ITEM_CLASS}
          >
            <Edit3 size={14} />
            Düzenle
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!onCopy}
            onSelect={() => onCopy?.()}
            className={ITEM_CLASS}
          >
            <Copy size={14} />
            Kopyala
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!onDelete}
            onSelect={() => onDelete?.()}
            className={`${ITEM_CLASS} data-[highlighted]:text-[var(--danger)]`}
          >
            <Trash2 size={14} />
            Sil
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

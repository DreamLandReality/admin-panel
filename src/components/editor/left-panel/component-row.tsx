'use client'

import { PathIcon } from '@/components/icons'
import { Toggle } from '@/components/primitives'
import { cn } from '@/lib/utils/cn'

interface ComponentRowProps {
  sectionId?: string
  iconPath: string
  label: string
  active: boolean
  enabled?: boolean
  onToggle?: (value: boolean) => void
  onClick: () => void
}

export function ComponentRow({
  sectionId,
  iconPath,
  label,
  active,
  enabled,
  onToggle,
  onClick,
}: ComponentRowProps) {
  return (
    <div
      data-section-row={sectionId}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 mx-1 rounded-md cursor-pointer transition-colors',
        active
          ? 'bg-white/10 text-foreground'
          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
        enabled === false && 'opacity-40'
      )}
    >
      <div className="w-5 h-5 rounded flex items-center justify-center bg-white/5 flex-shrink-0">
        <PathIcon path={iconPath} width={10} height={10} strokeWidth={1.5} />
      </div>
      <span className="flex-1 text-xs truncate">{label}</span>
      {onToggle && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <Toggle checked={enabled ?? true} onChange={onToggle} />
        </div>
      )}
    </div>
  )
}

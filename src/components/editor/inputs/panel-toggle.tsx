'use client'

import { cn } from '@/lib/utils/cn'

export function PanelToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <button
        onClick={() => onChange(!value)}
        aria-checked={value}
        role="switch"
        className={cn(
          'relative w-8 h-[18px] rounded-full transition-colors duration-200 flex-shrink-0',
          value ? 'bg-accent' : 'bg-white/10'
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform duration-200',
            value ? 'translate-x-[14px]' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  )
}

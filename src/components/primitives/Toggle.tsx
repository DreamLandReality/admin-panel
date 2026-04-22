'use client'
import { cn } from '@/lib/utils/cn'

const sizeConfig = {
  sm: {
    track: 'h-[14px] w-[24px]',
    thumb: 'h-3 w-3',
    translate: 'translate-x-[10px]',
  },
  md: {
    track: 'h-[18px] w-[32px]',
    thumb: 'h-4 w-4',
    translate: 'translate-x-[14px]',
  },
} as const

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  size?: keyof typeof sizeConfig
  disabled?: boolean
  className?: string
}

export function Toggle({ checked, onChange, size = 'sm', disabled, className }: ToggleProps) {
  const cfg = sizeConfig[size]
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative rounded-full transition-colors flex-shrink-0 cursor-pointer',
        cfg.track,
        checked ? 'bg-white/50' : 'bg-white/10',
        disabled && 'opacity-40 pointer-events-none',
        className,
      )}
    >
      <span
        className={cn(
          'absolute top-[1px] left-[1px] rounded-full bg-background transition-transform',
          cfg.thumb,
          checked && cfg.translate,
        )}
      />
    </button>
  )
}

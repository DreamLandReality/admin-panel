'use client'

import { cn } from '@/lib/utils/cn'
import { PlusIcon } from '@/components/icons'

function isNativeColorValue(value: string | undefined): value is string {
  return /^#[0-9a-f]{6}$/i.test(value ?? '')
}

export function StyleColorGrid({
  label,
  presets,
  current,
  onSelect,
}: {
  label: string
  presets: { value: string; label: string }[]
  current: string | undefined
  onSelect: (value: string) => void
}) {
  const isCustom = current && !presets.some((p) => p.value === current)

  return (
    <div>
      <p className="text-label uppercase tracking-label text-muted-foreground mb-2">{label}</p>
      <div className="grid grid-cols-5 gap-1.5">
        {presets.map((c) => (
          <button
            key={c.value}
            title={c.label}
            onClick={() => onSelect(c.value)}
            data-swatch={c.value}
            className={cn(
              'w-full aspect-square rounded-md border-2 transition-colors',
              current === c.value
                ? 'border-info'
                : 'border-transparent hover:border-border-hover',
              c.value === 'transparent'
                ? 'bg-transparent border-dashed'
                : c.value === 'inherit'
                  ? 'bg-foreground'
                  : 'style-swatch'
            )}
          />
        ))}
        <label
          title="Custom color"
          className={cn(
            'w-full aspect-square rounded-md border-2 transition-colors cursor-pointer flex items-center justify-center relative overflow-hidden',
            isCustom ? 'border-info' : 'border-transparent hover:border-border-hover',
            isCustom ? '' : 'bg-surface-active'
          )}
        >
          {!isCustom && (
            <PlusIcon width={14} height={14} strokeWidth={1.4} className="text-muted-foreground" />
          )}
          <input
            type="color"
            value={isNativeColorValue(current) ? current : ''}
            onChange={(e) => onSelect(e.target.value)}
            className={cn(
              'absolute inset-0 cursor-pointer rounded-md border-0 bg-transparent p-0 [appearance:none] [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0',
              isCustom ? 'opacity-100' : 'opacity-0'
            )}
          />
        </label>
      </div>
    </div>
  )
}

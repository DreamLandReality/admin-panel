'use client'

import { cn } from '@/lib/utils/cn'
import { PanelField } from './panel-field'

export function PanelColorInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <PanelField label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 flex-shrink-0 cursor-pointer rounded-md border border-white/10 bg-transparent p-0 [appearance:none] [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn('panel-input flex-1 ')}
        />
      </div>
    </PanelField>
  )
}

'use client'

import { useUiStore } from '@/stores/ui-store'
import { ViewportSwitcher } from '../viewport-switcher'
import type { ResponsiveStyleValue, StyleControl } from '@/types'

const BREAKPOINTS = [
  { key: 'mobile' as const, label: 'Mobile', width: '375px' },
  { key: 'tablet' as const, label: 'Tablet', width: '768px' },
  { key: 'desktop' as const, label: 'Desktop', width: '1440px' },
]

export function ResponsiveStyleSlider({
  ctrl,
  value,
  onChange,
}: {
  ctrl: StyleControl
  value: ResponsiveStyleValue
  onChange: (v: ResponsiveStyleValue) => void
}) {
  const viewport = useUiStore((s) => s.viewport)
  const unit = ctrl.unit ?? ''
  const raw = value[viewport] ?? ctrl.default ?? ''
  const numVal = parseFloat(raw as string) || (ctrl.min ?? 0)
  const display = unit ? `${numVal}${unit}` : String(numVal)
  const currentBreakpoint = BREAKPOINTS.find(b => b.key === viewport)

  function handleChange(v: number) {
    const formatted = unit ? `${v}${unit}` : String(v)
    onChange({ ...value, [viewport]: formatted })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-label uppercase tracking-label text-muted-foreground">{ctrl.label}</p>
        <span className="text-label tabular-nums text-primary font-medium">{display}</span>
      </div>

      <ViewportSwitcher showLabels iconSize={12} />

      <div className="text-xs text-muted-foreground/50">
        {currentBreakpoint?.label} ({currentBreakpoint?.width})
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground/50">
          <span>{ctrl.min ?? 0}{unit}</span>
          <span>{ctrl.max ?? 100}{unit}</span>
        </div>
        <input
          type="range"
          min={ctrl.min ?? 0}
          max={ctrl.max ?? 100}
          step={ctrl.step ?? 1}
          value={numVal}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
      </div>
    </div>
  )
}

export function StyleSlider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-label uppercase tracking-label text-muted-foreground">{label}</p>
        <span className="text-label-lg text-muted-foreground tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-white"
      />
    </div>
  )
}

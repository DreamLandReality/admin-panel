'use client'

import { useUiStore } from '@/stores/ui-store'
import { ViewportSwitcher } from './viewport-switcher'

interface ResponsiveSliderProps {
  label: string
  value: {
    mobile: string
    tablet: string
    desktop: string
  }
  config: {
    mobile: { min: number; max: number; step: number; unit: string; label: string }
    tablet: { min: number; max: number; step: number; unit: string; label: string }
    desktop: { min: number; max: number; step: number; unit: string; label: string }
  }
  onChange: (value: { mobile: string; tablet: string; desktop: string }) => void
}

export function ResponsiveSlider({ label, value, config, onChange }: ResponsiveSliderProps) {
  // Use global viewport so switching here also resizes the preview iframe
  const viewport = useUiStore((s) => s.viewport)

  const currentConfig = config[viewport]
  const currentValue = parseFloat(value[viewport])
  const displayValue = isNaN(currentValue) ? 0 : currentValue

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-label uppercase tracking-label text-muted-foreground">
          {label}
        </label>
        <span className="text-label tabular-nums text-primary font-medium">
          {displayValue.toFixed(2)}{currentConfig.unit}
        </span>
      </div>

      {/* Breakpoint Tabs */}
      <ViewportSwitcher showLabels iconSize={12} />

      {/* Slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground/50">
          <span>{currentConfig.min}{currentConfig.unit}</span>
          <span>{currentConfig.max}{currentConfig.unit}</span>
        </div>
        <input
          type="range"
          min={currentConfig.min}
          max={currentConfig.max}
          step={currentConfig.step}
          value={displayValue}
          onChange={(e) => {
            const newValue = `${e.target.value}${currentConfig.unit}`
            onChange({ ...value, [viewport]: newValue })
          }}
          className="w-full accent-primary"
        />
      </div>
    </div>
  )
}

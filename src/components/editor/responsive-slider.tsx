'use client'

import { cn } from '@/lib/utils/cn'
import { useWizardStore } from '@/stores/wizard-store'

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

function MobileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  )
}

function TabletIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  )
}

function DesktopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

const BREAKPOINT_ICONS = {
  mobile: MobileIcon,
  tablet: TabletIcon,
  desktop: DesktopIcon,
} as const

const BREAKPOINT_LABELS = {
  mobile: 'Mobile',
  tablet: 'Tablet',
  desktop: 'Desktop',
} as const

export function ResponsiveSlider({ label, value, config, onChange }: ResponsiveSliderProps) {
  // Use global viewport so switching here also resizes the preview iframe
  const { viewport, setViewport } = useWizardStore((s) => ({ viewport: s.viewport, setViewport: s.setViewport }))

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
      <div className="flex gap-0.5 bg-black/20 border border-white/5 rounded-md p-0.5">
        {(['mobile', 'tablet', 'desktop'] as const).map((bp) => {
          const Icon = BREAKPOINT_ICONS[bp]
          const isActive = viewport === bp
          return (
            <button
              key={bp}
              type="button"
              onClick={() => setViewport(bp)}
              title={`${BREAKPOINT_LABELS[bp]}`}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded transition-all',
                isActive
                  ? 'bg-white/10 text-foreground shadow-sm'
                  : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/5'
              )}
            >
              <Icon />
              <span>{BREAKPOINT_LABELS[bp]}</span>
            </button>
          )
        })}
      </div>

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

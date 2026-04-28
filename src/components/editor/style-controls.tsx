'use client'

import { cn } from '@/lib/utils/cn'
import { useWizardStore } from '@/stores/wizard-store'
import { useUiStore } from '@/stores/ui-store'
import { useEditorStore } from '@/stores/editor-store'
import { ButtonGroup } from '@/components/primitives'
import { getFieldDefaults } from '@/lib/utils/style-defaults'
import { postToIframe } from '@/lib/utils/iframe'
import { ViewportSwitcher } from './viewport-switcher'
import type { ManifestSection, StyleControl, ResponsiveStyleValue } from '@/types'

// ─── STYLE_ICONS ──────────────────────────────────────────────────────────────

const STYLE_ICONS: Record<string, string> = {
  'align-left': 'M3 6h18M3 10h12M3 14h18M3 18h12',
  'align-center': 'M3 6h18M6 10h12M3 14h18M6 18h12',
  'align-right': 'M3 6h18M9 10h12M3 14h18M9 18h12',
}

// ─── StyleSection ─────────────────────────────────────────────────────────────

export function StyleSection({
  label,
  sectionId,
  styleKey,
  controls,
  iframeRef,
}: {
  label: string
  sectionId: string
  styleKey: string
  controls: StyleControl[]
  iframeRef: React.RefObject<HTMLIFrameElement | null>
}) {
  const sectionData = useEditorStore((s) => s.sectionData)
  const selectedTemplate = useWizardStore((s) => s.selectedTemplate)
  const updateStyle = useEditorStore((s) => s.updateStyle)
  const section = selectedTemplate?.manifest?.sections?.find((s: ManifestSection) => s.id === sectionId)
  const defaults = getFieldDefaults(section?.styleControls, styleKey)
  const rawSectionData = sectionData[sectionId]
  const overridesSource = Array.isArray(rawSectionData)
    ? ((sectionData[`${sectionId}__styles`] as Record<string, any>) ?? {})
    : (rawSectionData ?? {})
  const overrides: Record<string, any> = (overridesSource[`${styleKey}__style`] as any) ?? {}
  const currentStyle: Record<string, any> = { ...defaults, ...overrides }

  function applyStyle(styles: Record<string, any>) {
    updateStyle(sectionId, styleKey, styles)
    postToIframe(iframeRef, { type: 'style-update', sectionId, field: styleKey, styles })
  }

  return (
    <div className="mb-3">
      <p className="text-label uppercase tracking-label text-muted-foreground/60 mb-2">{label}</p>
      <div className="space-y-4">
        {controls.map((ctrl, i) => renderStyleControl(ctrl, i, currentStyle, applyStyle))}
      </div>
    </div>
  )
}

// ─── renderStyleControl ───────────────────────────────────────────────────────

export function renderStyleControl(
  ctrl: StyleControl,
  index: number,
  currentStyle: Record<string, any>,
  applyStyle: (styles: Record<string, any>) => void,
) {
  switch (ctrl.type) {
    case 'buttonGroup': {
      const hasIcons = ctrl.options?.some((o) => o.icon)
      return (
        <StyleButtonGroup
          key={index}
          label={ctrl.label}
          options={ctrl.options ?? []}
          current={currentStyle[ctrl.property]}
          onSelect={(v) => applyStyle({ [ctrl.property]: v })}
          renderIcon={
            hasIcons
              ? (opt: any) => {
                const iconPath = STYLE_ICONS[opt.icon] || opt.icon
                return (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d={iconPath} />
                  </svg>
                )
              }
              : undefined
          }
        />
      )
    }
    case 'slider': {
      if (ctrl.responsive) {
        // Normalize: if the stored value is a flat string (e.g. template default "2rem"),
        // convert it to a responsive object so the spread in onChange works correctly.
        const rawVal = currentStyle[ctrl.property]
        const responsiveVal: ResponsiveStyleValue =
          (typeof rawVal === 'object' && rawVal !== null)
            ? rawVal
            : {
                mobile: rawVal ?? ctrl.default ?? '',
                tablet: rawVal ?? ctrl.default ?? '',
                desktop: rawVal ?? ctrl.default ?? '',
              }
        return (
          <ResponsiveStyleSlider
            key={index}
            ctrl={ctrl}
            value={responsiveVal}
            onChange={(v) => applyStyle({ [ctrl.property]: v })}
          />
        )
      }
      const val = parseFloat(currentStyle[ctrl.property] ?? String(ctrl.min ?? 0))
      const unit = ctrl.unit ?? ''
      const display = unit ? `${val}${unit}` : String(val)
      return (
        <StyleSlider
          key={index}
          label={ctrl.label}
          value={val}
          display={display}
          min={ctrl.min ?? 0}
          max={ctrl.max ?? 100}
          step={ctrl.step ?? 1}
          onChange={(v) => {
            const formatted = unit ? `${v}${unit}` : String(v)
            const styles: Record<string, any> = { [ctrl.property]: formatted }
            if (ctrl.linked) styles[ctrl.linked] = formatted
            applyStyle(styles)
          }}
        />
      )
    }
    case 'colorGrid': {
      return (
        <StyleColorGrid
          key={index}
          label={ctrl.label}
          presets={ctrl.presets ?? []}
          current={currentStyle[ctrl.property]}
          onSelect={(v) => applyStyle({ [ctrl.property]: v })}
        />
      )
    }
    default:
      return null
  }
}

// ─── ResponsiveStyleSlider ────────────────────────────────────────────────────

const BREAKPOINTS = [
  { key: 'mobile' as const, label: 'Mobile', width: '375px' },
  { key: 'tablet' as const, label: 'Tablet', width: '768px' },
  { key: 'desktop' as const, label: 'Desktop', width: '1440px' },
]

function ResponsiveStyleSlider({
  ctrl,
  value,
  onChange,
}: {
  ctrl: StyleControl
  value: ResponsiveStyleValue
  onChange: (v: ResponsiveStyleValue) => void
}) {
  // Use global viewport so switching breakpoint here also resizes the preview iframe
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

      {/* Breakpoint Tabs */}
      <ViewportSwitcher showLabels iconSize={12} />

      {/* Current value label */}
      <div className="text-xs text-muted-foreground/50">
        {currentBreakpoint?.label} ({currentBreakpoint?.width})
      </div>

      {/* Slider */}
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

// ─── StyleButtonGroup ─────────────────────────────────────────────────────────

export function StyleButtonGroup({
  label,
  options,
  current,
  onSelect,
  renderIcon,
}: {
  label: string
  options: { value: string; label: string; icon?: string }[]
  current: string | undefined
  onSelect: (value: string) => void
  renderIcon?: (opt: any) => React.ReactNode
}) {
  return (
    <div>
      <p className="text-label uppercase tracking-label text-muted-foreground mb-2">{label}</p>
      <ButtonGroup
        options={options.map((o) => ({ value: o.value, label: renderIcon ? renderIcon(o) : o.label }))}
        value={current ?? ''}
        onChange={onSelect}
      />
    </div>
  )
}

// ─── StyleSlider ──────────────────────────────────────────────────────────────

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

// ─── StyleColorGrid ───────────────────────────────────────────────────────────

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
            className={cn(
              'w-full aspect-square rounded-md border-2 transition-colors',
              current === c.value
                ? 'border-info'
                : 'border-transparent hover:border-border-hover',
              c.value === 'transparent'
                ? 'bg-transparent border-dashed'
                : c.value === 'inherit'
                  ? 'bg-foreground'
                  : ''
            )}
            style={
              c.value !== 'transparent' && c.value !== 'inherit'
                ? { backgroundColor: c.value }
                : undefined
            }
          />
        ))}
        {/* Custom color picker */}
        <label
          title="Custom color"
          className={cn(
            'w-full aspect-square rounded-md border-2 transition-colors cursor-pointer flex items-center justify-center relative overflow-hidden',
            isCustom ? 'border-info' : 'border-transparent hover:border-border-hover'
          )}
          style={isCustom ? { backgroundColor: current } : undefined}
        >
          {!isCustom && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-muted-foreground">
              <path d="M7 2v10M2 7h10" />
            </svg>
          )}
          <input
            type="color"
            value={isCustom ? current : '#000000'}
            onChange={(e) => onSelect(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      </div>
    </div>
  )
}

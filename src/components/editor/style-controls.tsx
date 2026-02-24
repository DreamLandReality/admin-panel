'use client'

import { cn } from '@/lib/utils/cn'
import { useWizardStore } from '@/stores/wizard-store'
import { getFieldDefaults } from '@/lib/utils/style-defaults'
import { postToIframe } from '@/lib/utils/iframe'
import type { ManifestSection, StyleControl } from '@/types'

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
  const { sectionData, selectedTemplate, updateStyle } = useWizardStore()
  const section = selectedTemplate?.manifest?.sections?.find((s: ManifestSection) => s.id === sectionId)
  const defaults = getFieldDefaults(section?.styleControls, styleKey)
  const rawSectionData = sectionData[sectionId]
  const overridesSource = Array.isArray(rawSectionData)
    ? ((sectionData[`${sectionId}__styles`] as Record<string, any>) ?? {})
    : (rawSectionData ?? {})
  const overrides: Record<string, string> = (overridesSource[`${styleKey}__style`] as any) ?? {}
  const currentStyle: Record<string, string> = { ...defaults, ...overrides }

  function applyStyle(styles: Record<string, string>) {
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
  currentStyle: Record<string, string>,
  applyStyle: (styles: Record<string, string>) => void,
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
            const styles: Record<string, string> = { [ctrl.property]: formatted }
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
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            aria-pressed={current === opt.value}
            className={cn(
              'flex-1 h-8 rounded text-xs flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500',
              current === opt.value
                ? 'bg-foreground text-background font-medium'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            )}
          >
            {renderIcon ? renderIcon(opt) : opt.label}
          </button>
        ))}
      </div>
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
        <span className="text-[11px] text-muted-foreground tabular-nums">{display}</span>
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
                ? 'border-blue-500'
                : 'border-transparent hover:border-white/20',
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
            isCustom ? 'border-blue-500' : 'border-transparent hover:border-white/20'
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

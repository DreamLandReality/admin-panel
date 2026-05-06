'use client'

import { useWizardStore } from '@/stores/wizard-store'
import { useEditorStore } from '@/stores/editor-store'
import { getFieldDefaults } from '@/lib/utils/style-defaults'
import { postToIframe } from '@/lib/utils/iframe'
import { PathIcon } from '@/components/icons'
import { ResponsiveStyleSlider, StyleSlider } from './style-slider'
import { StyleButtonGroup } from './style-button-group'
import { StyleColorGrid } from './style-color-grid'
import type { ManifestSection, ResponsiveStyleValue, StyleControl } from '@/types'

const STYLE_ICONS: Record<string, string> = {
  'align-left': 'M3 6h18M3 10h12M3 14h18M3 18h12',
  'align-center': 'M3 6h18M6 10h12M3 14h18M6 18h12',
  'align-right': 'M3 6h18M9 10h12M3 14h18M9 18h12',
}

function normalizeStyleOption(option: string | { value: string; label: string; icon?: string }) {
  return typeof option === 'string' ? { value: option, label: option } : option
}

function normalizeColorPreset(preset: unknown): { value: string; label: string } | null {
  if (typeof preset === 'string') return { value: preset, label: preset }
  if (preset && typeof preset === 'object' && !Array.isArray(preset)) {
    const value = (preset as Record<string, unknown>).value
    const label = (preset as Record<string, unknown>).label
    if (typeof value === 'string' && typeof label === 'string') {
      return { value, label }
    }
  }
  return null
}

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

function renderStyleControl(
  ctrl: StyleControl,
  index: number,
  currentStyle: Record<string, any>,
  applyStyle: (styles: Record<string, any>) => void,
) {
  switch (ctrl.type) {
    case 'buttonGroup': {
      const options = (ctrl.options ?? []).map(normalizeStyleOption)
      const hasIcons = options.some((o) => o.icon)
      return (
        <StyleButtonGroup
          key={index}
          label={ctrl.label}
          options={options}
          current={currentStyle[ctrl.property]}
          onSelect={(v) => applyStyle({ [ctrl.property]: v })}
          renderIcon={
            hasIcons
              ? (opt: any) => {
                const iconPath = STYLE_ICONS[opt.icon] || opt.icon
                return <PathIcon path={iconPath} width={14} height={14} strokeWidth={2} />
              }
              : undefined
          }
        />
      )
    }
    case 'slider': {
      if (ctrl.responsive) {
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
      const presets = (ctrl.presets ?? []).map(normalizeColorPreset).filter((preset): preset is { value: string; label: string } => preset !== null)
      return (
        <StyleColorGrid
          key={index}
          label={ctrl.label}
          presets={presets}
          current={currentStyle[ctrl.property]}
          onSelect={(v) => applyStyle({ [ctrl.property]: v })}
        />
      )
    }
    default:
      return null
  }
}

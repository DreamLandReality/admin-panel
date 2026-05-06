'use client'

import { usePageList } from '@/hooks/use-page-list'
import { TextInput } from '@/components/forms'

export function PanelPagePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const pages = usePageList()
  const options = pages.map((p) => ({ label: p.name, value: p.path }))
  const isCustom = !!value && !options.some((o) => o.value === value)

  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      <select
        value={isCustom ? '__custom__' : (value || '')}
        onChange={(e) => { if (e.target.value !== '__custom__') onChange(e.target.value) }}
        className="panel-input"
      >
        <option value="">— select page —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        {isCustom && <option value="__custom__">{value} (custom)</option>}
      </select>
      <TextInput
        variant="panel"
        type="text"
        value={value}
        placeholder="or type a custom URL"
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 text-xs py-1.5 placeholder:text-muted-foreground/40"
      />
    </div>
  )
}

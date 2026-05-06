'use client'

import { PanelField } from './panel-field'

export function PanelSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[] | { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  const normalizedOptions = options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  )

  return (
    <PanelField label={label}>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-md bg-surface border border-border-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
      >
        <option value="">— select —</option>
        {normalizedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </PanelField>
  )
}

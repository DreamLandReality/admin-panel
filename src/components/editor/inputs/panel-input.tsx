'use client'

import { TextInput } from '@/components/forms'
import { PanelField } from './panel-field'

export function PanelInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
}) {
  return (
    <PanelField label={label}>
      <TextInput
        variant="panel"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="placeholder:text-muted-foreground/40"
      />
    </PanelField>
  )
}

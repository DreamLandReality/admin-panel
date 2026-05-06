'use client'

import { TextInput } from '@/components/forms'
import { PanelField } from './panel-field'

export function PanelNumberInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <PanelField label={label}>
      <TextInput
        variant="panel"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </PanelField>
  )
}

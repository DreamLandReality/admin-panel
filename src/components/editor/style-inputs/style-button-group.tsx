'use client'

import { ButtonGroup } from '@/components/primitives'

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

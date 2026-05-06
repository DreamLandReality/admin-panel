'use client'

import { useEffect, useRef } from 'react'
import { TextArea } from '@/components/forms'
import { PanelField } from './panel-field'

export function PanelTextarea({
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
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <PanelField label={label}>
      <TextArea
        ref={ref}
        variant="panel"
        value={value}
        placeholder={placeholder}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        className="placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      />
    </PanelField>
  )
}

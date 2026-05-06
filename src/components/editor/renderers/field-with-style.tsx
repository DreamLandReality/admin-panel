'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { StyleSection } from '../style-inputs'
import { ChevronRightIcon } from '@/components/icons'
import type { StyleControl } from '@/types'

export function FieldWithStyle({
  fieldKey,
  sectionId,
  styleControls,
  iframeRef,
  children,
}: {
  fieldKey: string
  sectionId: string
  styleControls: StyleControl[]
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      {children}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'mt-1 w-full flex items-center justify-between px-2 py-1.5 rounded transition-colors',
          open ? 'bg-accent/10 text-accent' : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/5'
        )}
      >
        <span className="text-[10px] uppercase tracking-wider">Style</span>
        <ChevronRightIcon
          width={9}
          height={9}
          strokeWidth={2.5}
          className={cn('transition-transform duration-150', open && 'rotate-90')}
        />
      </button>
      {open && (
        <div className="mt-1.5 px-2 pt-2 pb-2 rounded bg-white/[0.03] border border-white/5 space-y-3">
          <StyleSection
            label=""
            sectionId={sectionId}
            styleKey={fieldKey}
            controls={styleControls}
            iframeRef={iframeRef}
          />
        </div>
      )}
    </div>
  )
}

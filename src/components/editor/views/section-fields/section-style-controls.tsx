'use client'

import type { RefObject } from 'react'
import { StyleSection } from '../../style-inputs'
import type { StyleControl } from '@/types'

interface SectionStyleControlsProps {
  sectionId: string
  controls: StyleControl[]
  iframeRef: RefObject<HTMLIFrameElement | null>
}

export function SectionStyleControls({
  sectionId,
  controls,
  iframeRef,
}: SectionStyleControlsProps) {
  if (controls.length === 0) return null

  return (
    <>
      <div className="border-t border-white/5 mt-4 pt-4">
        <p className="text-label uppercase tracking-label text-muted-foreground mb-3">Layout</p>
      </div>
      <StyleSection
        label=""
        sectionId={sectionId}
        styleKey="__section"
        controls={controls}
        iframeRef={iframeRef}
      />
    </>
  )
}

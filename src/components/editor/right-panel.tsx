'use client'

import React, { useEffect, useRef } from 'react'
import { MousePointerClick } from 'lucide-react'
import { useWizardStore } from '@/stores/wizard-store'
import { SharedLabelsView } from './views/shared-labels-view'
import { SectionFieldsView } from './views/section-fields-view'
import { DetailGroupView } from './views/detail-group-view'
import { ImageReplaceView } from './views/image-replace-view'
import { EmptyState } from '@/components/dashboard/empty-state'

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export const RightPanel = React.memo(function RightPanel({ iframeRef }: { iframeRef: React.RefObject<HTMLIFrameElement | null> }) {
  const { mode, sectionId, field } = useWizardStore((s) => s.selection)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Reset scroll to top whenever the selected component changes
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [sectionId])

  // Scroll to field when iframe fires element-selected with a field name
  useEffect(() => {
    if (!field || !scrollRef.current) return
    const el = scrollRef.current.querySelector(`[data-field-key="${field}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [field])

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      {/* Nothing selected — prompt user to pick a component */}
      {!sectionId && (
        <EmptyState
          size="sm"
          icon={<MousePointerClick className="h-4 w-4" />}
          heading="Nothing selected"
          description="Click a section to start editing"
        />
      )}

      {/* Image replace overlay (iframe image click) */}
      {sectionId && mode === 'image' && <ImageReplaceView iframeRef={iframeRef} />}

      {/* Shared labels for dynamic page parent (e.g. detailPageLabels) */}
      {sectionId?.startsWith('labels:') && mode !== 'image' && (
        <SharedLabelsView iframeRef={iframeRef} />
      )}

      {/* Dynamic page detail group editor */}
      {sectionId?.startsWith('detail:') && mode !== 'image' && (
        <DetailGroupView groupId={sectionId.replace('detail:', '')} iframeRef={iframeRef} />
      )}

      {/* Normal manifest section fields + styles */}
      {sectionId && !sectionId.startsWith('detail:') && !sectionId.startsWith('labels:') && mode !== 'image' && (
        <SectionFieldsView iframeRef={iframeRef} />
      )}
    </div>
  )
})


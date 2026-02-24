'use client'

import { useEffect, useRef } from 'react'
import { useWizardStore } from '@/stores/wizard-store'
import { SharedLabelsView } from './views/shared-labels-view'
import { SectionFieldsView } from './views/section-fields-view'
import { DetailGroupView } from './views/detail-group-view'
import { ImageReplaceView } from './views/image-replace-view'

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export function RightPanel({ iframeRef }: { iframeRef: React.RefObject<HTMLIFrameElement | null> }) {
  const { mode, sectionId } = useWizardStore((s) => s.selection)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Reset scroll to top whenever the selected component changes
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [sectionId])

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      {/* Nothing selected — prompt user to pick a component */}
      {!sectionId && <EmptySelectionState />}

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
}

// ─── EmptySelectionState ──────────────────────────────────────────────────────

function EmptySelectionState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Select a component from the left panel to edit its content and styles.
      </p>
    </div>
  )
}

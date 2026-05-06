'use client'

import { useEffect, type RefObject } from 'react'

interface UseLeftPanelFocusOptions {
  selectedSectionId: string | null
  listRef: RefObject<HTMLDivElement | null>
}

export function useLeftPanelFocus({
  selectedSectionId,
  listRef,
}: UseLeftPanelFocusOptions) {
  useEffect(() => {
    if (!selectedSectionId || !listRef.current) return

    const element = listRef.current.querySelector(`[data-section-row="${selectedSectionId}"]`)
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [listRef, selectedSectionId])

  useEffect(() => {
    function handleFocusSection(event: CustomEvent<{ sectionId?: string }>) {
      const { sectionId } = event.detail
      if (!sectionId || !listRef.current) return

      const element = listRef.current.querySelector(`[data-section-row="${sectionId}"]`)
      if (!element) return

      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      element.classList.add('animate-pulse')
      window.setTimeout(() => element.classList.remove('animate-pulse'), 1000)
    }

    window.addEventListener('editor:focus-section', handleFocusSection as EventListener)
    return () => window.removeEventListener('editor:focus-section', handleFocusSection as EventListener)
  }, [listRef])
}

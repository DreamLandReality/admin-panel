'use client'

import { useEffect } from 'react'
import { useHeaderStore } from '@/stores/header-store'

interface SyncHeaderContentProps {
  children: React.ReactNode
}

/**
 * Push custom content to the header's right side from any page.
 * Automatically clears on unmount.
 *
 * @example
 * <SyncHeaderContent>
 *   <CustomButton />
 * </SyncHeaderContent>
 */
export function SyncHeaderContent({ children }: SyncHeaderContentProps) {
  const setRightContent = useHeaderStore((s) => s.setRightContent)
  const clearRightContent = useHeaderStore((s) => s.clearRightContent)

  useEffect(() => {
    setRightContent(children)
    return () => clearRightContent()
  }, [children, setRightContent, clearRightContent])

  return null
}

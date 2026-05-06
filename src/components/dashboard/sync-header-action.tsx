'use client'

import { useEffect } from 'react'
import { useHeaderStore } from '@/stores/header-store'

export function SyncHeaderAction({ href, label }: { href: string; label: string }) {
  const setHeaderAction = useHeaderStore((s) => s.setHeaderAction)
  const clearHeaderRight = useHeaderStore((s) => s.clearHeaderRight)

  useEffect(() => {
    setHeaderAction({ href, label })
    return () => clearHeaderRight()
  }, [href, label, setHeaderAction, clearHeaderRight])

  return null
}

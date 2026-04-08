'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useHeaderStore } from '@/stores/header-store'

export function SyncHeaderAction({ href, label }: { href: string; label: string }) {
  const setRightContent = useHeaderStore((s) => s.setRightContent)
  const clearRightContent = useHeaderStore((s) => s.clearRightContent)

  useEffect(() => {
    setRightContent(
      <Link href={href} className="group text-center min-w-[52px]">
        <p className="font-serif text-3xl font-light leading-none text-foreground-muted group-hover:text-foreground transition-colors duration-200">
          +
        </p>
        <p className="mt-1.5 text-micro font-bold uppercase tracking-label text-foreground-muted">
          {label}
        </p>
      </Link>
    )
    return () => clearRightContent()
  }, [href, label, setRightContent, clearRightContent])

  return null
}

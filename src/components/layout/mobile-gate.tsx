'use client'

import { useEffect, useState } from 'react'
import { Monitor } from 'lucide-react'

export function MobileGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Render nothing until after mount to avoid hydration mismatch
  if (isMobile === null) return null

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center p-8 text-center">
        <Monitor className="w-10 h-10 text-accent mb-6" />
        <h1 className="font-serif text-xl text-foreground">
          Best experienced on a larger screen
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
          This admin panel is optimised for tablet and desktop. Please open it on a device wider than 768px.
        </p>
      </div>
    )
  }

  return <>{children}</>
}

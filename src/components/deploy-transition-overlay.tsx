'use client'

import { useEffect, useRef, useState } from 'react'
import { useDeployTransitionStore } from '@/stores/deploy-transition-store'

/**
 * Full-screen dark cover rendered in the ROOT layout.
 * Activates when a deploy navigation starts and clears once the progress page mounts.
 *
 * The overlay renders immediately (synchronously) when isTransitioning becomes true
 * so it is painted before the next frame when navigation begins. On dismiss it fades
 * out over 200ms before unmounting.
 */
export function DeployTransitionOverlay() {
  const isTransitioning = useDeployTransitionStore((s) => s.isTransitioning)
  const [fadingOut, setFadingOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isTransitioning && !fadingOut) return

    if (!isTransitioning) {
      // Start fade-out, then unmount after animation
      setFadingOut(true)
      timerRef.current = setTimeout(() => setFadingOut(false), 200)
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }
  }, [isTransitioning]) // eslint-disable-line react-hooks/exhaustive-deps

  // Render immediately when transitioning (no useEffect gate)
  if (!isTransitioning && !fadingOut) return null

  return (
    <div
      className="dark fixed inset-0 bg-background z-[9999] transition-opacity duration-200"
      style={{ opacity: isTransitioning ? 1 : 0 }}
    />
  )
}

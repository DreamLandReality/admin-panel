/**
 * R2Image Component
 *
 * Displays images from private Cloudflare R2 bucket using signed URLs
 *
 * Usage:
 *   <R2Image
 *     objectKey="screenshots/minimal-luxury/preview.png"
 *     alt="Template preview"
 *     className="w-full h-auto"
 *   />
 */

import { useR2Image } from '@/hooks/use-r2-image'
import Image from 'next/image'
import { useState } from 'react'
import { Skeleton } from '@/components/ui'

interface R2ImageProps {
  objectKey: string | null | undefined
  alt: string
  className?: string
  width?: number
  height?: number
  expiresIn?: number
}

export function R2Image({
  objectKey,
  alt,
  className,
  width,
  height,
  expiresIn = 3600
}: R2ImageProps) {
  const { imageUrl, loading, error } = useR2Image(objectKey, expiresIn)
  const [isLoaded, setIsLoaded] = useState(false)

  // Show skeleton during fetching signed url or error
  if (loading || error || !imageUrl) {
    return <Skeleton className={className} />
  }

  const handleLoad = () => setIsLoaded(true)
  const imageClasses = `${className || ''} ${!isLoaded ? 'hidden' : 'animate-in fade-in duration-300'}`

  return (
    <>
      {!isLoaded && <Skeleton className={className} />}
      {width && height ? (
        <Image
          src={imageUrl}
          alt={alt}
          className={imageClasses}
          width={width}
          height={height}
          onLoad={handleLoad}
        />
      ) : (
        <img
          src={imageUrl}
          alt={alt}
          className={imageClasses}
          width={width}
          height={height}
          onLoad={handleLoad}
        />
      )}
    </>
  )
}

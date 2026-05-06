'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils/cn'
import { ImagePlaceholderIcon } from '@/components/icons'

interface DeploymentThumbnailProps {
  src: string | null
  alt: string
  imageClassName?: string
  placeholderClassName?: string
}

export function DeploymentThumbnail({
  src,
  alt,
  imageClassName,
  placeholderClassName,
}: DeploymentThumbnailProps) {
  const [loaded, setLoaded] = useState(false)

  if (!src) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-thumbnail-placeholder text-muted-foreground/50',
          placeholderClassName,
        )}
      >
        <ImagePlaceholderIcon width={32} height={32} strokeWidth={1.4} />
      </div>
    )
  }

  return (
    <>
      {!loaded && <div className="absolute inset-0 z-10 animate-shimmer" />}
      <Image
        src={src}
        alt={alt}
        fill
        onLoad={() => setLoaded(true)}
        className={cn(imageClassName, !loaded && 'opacity-0')}
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
      />
    </>
  )
}

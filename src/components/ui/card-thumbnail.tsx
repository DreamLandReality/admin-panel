import { cn } from '@/lib/utils/cn'

interface CardThumbnailProps {
  src?: string | null
  alt: string
  aspectRatio?: '4/5' | '4/3' | 'video'
  hoverScale?: boolean
  filterClass?: string
  overlay?: React.ReactNode
}

const aspectCls = {
  '4/5':  'aspect-card bg-muted',
  '4/3':  'aspect-card-wide bg-muted',
  'video': 'aspect-video bg-white/5',
}

const PlaceholderIcon = () => (
  <svg
    className="w-8 h-8"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
)

export function CardThumbnail({
  src,
  alt,
  aspectRatio = '4/5',
  hoverScale = true,
  filterClass,
  overlay,
}: CardThumbnailProps) {
  return (
    <div className={cn('relative overflow-hidden', aspectCls[aspectRatio])}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-transform duration-300',
            hoverScale && 'group-hover:scale-105',
            filterClass,
          )}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
          <PlaceholderIcon />
        </div>
      )}
      {overlay}
    </div>
  )
}

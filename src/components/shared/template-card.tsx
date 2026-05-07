import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { AnimatedCard } from '@/components/ui/animated-card'
import { R2Image } from '@/components/r2-image'
import { CheckIcon, ImageFrameIcon } from '@/components/icons'
import type { Template } from '@/types'

export function TemplateCard({
  template,
  isSelected = false,
  onSelect,
  href,
  index = 0,
}: {
  template: Template
  isSelected?: boolean
  onSelect?: (t: Template) => void
  href?: string
  index?: number
}) {
  const thumbnail = template.preview_image ?? (template.default_data as any)?.seo?.image ?? null
  const sectionCount = template.manifest?.sections?.length ?? 0

  const inner = (
    <div
      className={cn(
        'group rounded-xl border border-border bg-card overflow-hidden cursor-pointer',
        isSelected && 'ring-2 ring-foreground/20',
      )}
      onClick={!href ? () => onSelect?.(template) : undefined}
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {thumbnail ? (
          <R2Image
            objectKey={thumbnail}
            alt={template.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <ImageFrameIcon width={40} height={40} strokeWidth={1.5} />
          </div>
        )}

        {isSelected && (
          <div className="absolute inset-0 bg-foreground/10 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
              <CheckIcon width={14} height={14} stroke="white" strokeWidth={1.5} />
            </div>
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-label uppercase tracking-label text-muted-foreground mb-0.5">{template.category}</p>
        <p className="text-sm font-medium text-foreground leading-snug">{template.name}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-label-lg text-muted-foreground">{sectionCount} sections</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-label-lg text-muted-foreground">v{template.version}</span>
        </div>
      </div>
    </div>
  )

  const card = <AnimatedCard index={index}>{inner}</AnimatedCard>
  if (href) return <Link href={href} className="block">{card}</Link>
  return card
}

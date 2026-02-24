'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { useWizardStore } from '@/stores/wizard-store'
import { EmptyState } from '@/components/dashboard/empty-state'
import { R2Image } from '@/components/r2-image'
import type { Template, TemplateCategory } from '@/types'

const ALL_CATEGORIES: Array<{ value: 'all' | TemplateCategory; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'modern', label: 'Modern' },
  { value: 'investment', label: 'Investment' },
  { value: 'villa', label: 'Villa' },
  { value: 'affordable', label: 'Affordable' },
]

interface StepTemplatePickerProps {
  templates: Template[]
}

export function StepTemplatePicker({ templates }: StepTemplatePickerProps) {
  const selectTemplate = useWizardStore((s) => s.selectTemplate)
  const setStep = useWizardStore((s) => s.setStep)

  const [activeCategory, setActiveCategory] = useState<'all' | TemplateCategory>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered =
    activeCategory === 'all'
      ? templates
      : templates.filter((t) => t.category === activeCategory)

  const showFilters = templates.length > 1

  function handleSelect(template: Template) {
    setSelectedId(template.id)
    selectTemplate(template)
    setStep(2)
  }

  return (
    <div className="w-full flex-1 flex flex-col">
      <div className="max-w-5xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="font-serif text-[28px] font-light tracking-tight text-foreground">
            Choose a template
          </h1>
          <p className="text-foreground-muted mt-2 text-[13px] leading-relaxed tracking-wide">
            Pick the design that best fits your property.
          </p>
        </div>

        {/* Category filters */}
        {showFilters && (
          <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-1">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-widest whitespace-nowrap transition-all duration-200',
                  activeCategory === cat.value
                    ? 'bg-foreground text-background'
                    : 'text-foreground-muted hover:text-foreground hover:bg-foreground/5'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Template grid */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center w-full pb-20">
          <EmptyState
            heading="No templates available"
            description={
              activeCategory === 'all'
                ? 'Templates will appear here once they are added to the system.'
                : 'No templates in this category yet. Try selecting a different category.'
            }
            ctaLabel=""
            ctaHref=""
          />
        </div>
      ) : (
        <div className="max-w-5xl">
          <div className={cn(
            'grid gap-5',
            filtered.length === 1 ? 'max-w-xs' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
          )}>
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={template.id === selectedId}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function TemplateCard({
  template,
  isSelected = false,
  onSelect,
  href,
}: {
  template: Template
  isSelected?: boolean
  onSelect?: (t: Template) => void
  href?: string
}) {
  const thumbnail = template.preview_image ?? (template.default_data as any)?.seo?.image ?? null
  const sectionCount = template.manifest?.sections?.length ?? 0

  const inner = (
    <div
      className={cn(
        'group rounded-xl border bg-card overflow-hidden cursor-pointer transition-all duration-150',
        isSelected
          ? 'border-foreground ring-2 ring-foreground/20'
          : 'border-border hover:border-foreground/30'
      )}
      onClick={!href ? () => onSelect?.(template) : undefined}
    >
      {/* Thumbnail — 4:5 aspect ratio */}
      <div className="aspect-[4/5] bg-muted relative overflow-hidden">
        {thumbnail ? (
          <R2Image
            objectKey={thumbnail}
            alt={template.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="6" y="6" width="28" height="28" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 28l8-8 6 6 4-4 10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {/* Selected overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-foreground/10 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7l3 3 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-label uppercase tracking-label text-muted-foreground mb-0.5">{template.category}</p>
        <p className="text-sm font-medium text-foreground leading-snug">{template.name}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[11px] text-muted-foreground">{sectionCount} sections</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[11px] text-muted-foreground">v{template.version}</span>
        </div>
      </div>

      {/* Action button */}
      <div className="px-3 pb-3">
        {href ? (
          <span className="block w-full py-2 rounded-lg text-xs font-medium text-center bg-foreground/5 text-foreground group-hover:bg-foreground/10 transition-colors">
            Preview
          </span>
        ) : (
          <button
            className={cn(
              'w-full py-2 rounded-lg text-xs font-medium transition-colors',
              isSelected
                ? 'bg-foreground text-background'
                : 'bg-foreground/5 text-foreground hover:bg-foreground/10'
            )}
            onClick={(e) => { e.stopPropagation(); onSelect?.(template) }}
          >
            {isSelected ? 'Selected' : 'Select'}
          </button>
        )}
      </div>
    </div>
  )

  if (href) return <Link href={href} className="block">{inner}</Link>
  return inner
}

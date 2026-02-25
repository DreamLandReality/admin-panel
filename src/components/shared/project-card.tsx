'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { DASHBOARD_CARD_STAGGER_MS, DASHBOARD_MAX_STAGGER_CARDS } from '@/lib/constants'

// ─── Generic Project Card ────────────────────────────────────────────────────

interface ProjectCardProps {
  title: string
  label?: string        // small uppercase line above title
  meta1?: string        // left meta text
  meta2?: string        // right meta text
  thumbnail?: string | null
  href?: string
  index?: number
  isSelected?: boolean
  onSelect?: () => void
}

export function ProjectCard({
  title,
  label,
  meta1,
  meta2,
  thumbnail,
  href,
  index = 0,
  isSelected = false,
  onSelect,
}: ProjectCardProps) {
  const inner = (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{
        animationDelay: `${Math.min(index, DASHBOARD_MAX_STAGGER_CARDS) * DASHBOARD_CARD_STAGGER_MS}ms`,
        animationFillMode: 'forwards',
      }}
    >
      <div
        className={cn(
          'group rounded-xl border bg-card overflow-hidden cursor-pointer transition-all duration-150',
          isSelected
            ? 'border-foreground ring-2 ring-foreground/20'
            : 'border-border hover:border-foreground/30'
        )}
        onClick={!href ? onSelect : undefined}
      >
        {/* Thumbnail — 4:5 aspect */}
        <div className="aspect-[4/5] bg-muted relative overflow-hidden">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="6" y="6" width="28" height="28" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M6 28l8-8 6 6 4-4 10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {/* Selected badge */}
          {isSelected && (
            <div className="absolute left-2.5 top-2.5 z-10">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-foreground text-background text-[10px] font-medium uppercase tracking-wider">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Selected
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="text-label uppercase tracking-label text-muted-foreground mb-0.5 truncate">
            {label || '\u00A0'}
          </p>
          <p className="text-sm font-medium text-foreground leading-snug truncate">{title}</p>
          {(meta1 || meta2) && (
            <div className="flex items-center gap-2 mt-1.5">
              {meta1 && <span className="text-[11px] text-muted-foreground">{meta1}</span>}
              {meta1 && meta2 && <span className="text-muted-foreground/40">&middot;</span>}
              {meta2 && <span className="text-[11px] text-muted-foreground">{meta2}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (href) return <Link href={href} className="block">{inner}</Link>
  return inner
}

// ─── Add New Card ────────────────────────────────────────────────────────────

export function AddNewCard({ href, label = 'New Commission', index = 0 }: { href: string; label?: string; index?: number }) {
  return (
    <Link href={href} className="block">
      <div
        className="opacity-0 animate-fade-in-up"
        style={{
          animationDelay: `${Math.min(index, DASHBOARD_MAX_STAGGER_CARDS) * DASHBOARD_CARD_STAGGER_MS}ms`,
          animationFillMode: 'forwards',
        }}
      >
        <div className="group rounded-xl border-2 border-dashed border-border overflow-hidden cursor-pointer transition-all duration-200 hover:border-foreground/30">
          <div className="aspect-[4/5] flex flex-col items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border transition-all duration-200 group-hover:border-foreground/30 group-hover:scale-110">
              <Plus className="h-5 w-5 text-muted-foreground/40 transition-colors group-hover:text-foreground/60" />
            </div>
            <p className="text-xs text-muted-foreground/50 transition-colors group-hover:text-muted-foreground">
              {label}
            </p>
          </div>
          {/* Spacer to match info area height */}
          <div className="p-3">
            <p className="text-label text-transparent mb-0.5">&nbsp;</p>
            <p className="text-sm text-transparent">&nbsp;</p>
          </div>
        </div>
      </div>
    </Link>
  )
}

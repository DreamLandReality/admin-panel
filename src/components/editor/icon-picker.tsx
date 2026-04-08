'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils/cn'
import { searchIcons, ICON_CATEGORIES, getIconByName, type IconEntry } from './icon-registry'

// ─── IconSvg ─────────────────────────────────────────────────────────────────
// Renders a lucide icon from its path data

function IconSvg({ paths, className }: { paths: string[]; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

// ─── IconPickerField ──────────────────────────────────────────────────────────

export function IconPickerField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Derive current icon name and entry
  const currentName = value?.startsWith('lucide:') ? value.slice('lucide:'.length) : null
  const currentEntry = currentName ? getIconByName(currentName) : null

  // Filtered icons
  const filtered = useMemo(
    () => searchIcons(search, activeCategory === 'All' ? undefined : activeCategory),
    [search, activeCategory]
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50)
    } else {
      setSearch('')
      setActiveCategory('All')
    }
  }, [open])

  function handleSelect(entry: IconEntry) {
    onChange(`lucide:${entry.name}`)
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Label */}
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-left transition-colors',
          open
            ? 'border-accent/50 bg-accent/5'
            : 'border-border-subtle bg-surface hover:border-border-hover hover:bg-surface-hover'
        )}
      >
        {/* Icon preview */}
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-foreground/70">
          {currentEntry ? (
            <IconSvg paths={currentEntry.paths} className="w-4 h-4" />
          ) : (
            <svg className="w-4 h-4 text-muted-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          )}
        </span>

        {/* Label / placeholder */}
        <span className={cn('flex-1 text-xs truncate', currentEntry ? 'text-foreground' : 'text-muted-foreground/40')}>
          {currentEntry ? currentEntry.label : 'Select icon…'}
        </span>

        {/* Actions */}
        <span className="flex items-center gap-1 flex-shrink-0">
          {currentEntry && (
            <span
              role="button"
              onClick={handleClear}
              className="p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/10 transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg
            className={cn('w-3 h-3 text-muted-foreground/40 transition-transform duration-150', open && 'rotate-180')}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-lg border border-border-subtle bg-background shadow-xl overflow-hidden">

          {/* Search bar */}
          <div className="p-2 border-b border-border-subtle">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface border border-border-subtle">
              <svg className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search icons…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-muted-foreground/40 hover:text-muted-foreground">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 px-2 py-1.5 border-b border-border-subtle overflow-x-auto scrollbar-none">
            {['All', ...ICON_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'flex-shrink-0 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider transition-colors',
                  activeCategory === cat
                    ? 'bg-accent text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Icon grid */}
          <div className="overflow-y-auto max-h-52 p-2">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground/40 py-6">
                No icons found{search ? ` for "${search}"` : ''}
              </p>
            ) : (
              <div className="grid grid-cols-8 gap-0.5">
                {filtered.map((entry) => {
                  const isSelected = currentName === entry.name
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      onClick={() => handleSelect(entry)}
                      title={entry.label}
                      className={cn(
                        'group relative flex items-center justify-center w-full aspect-square rounded transition-colors',
                        isSelected
                          ? 'bg-accent text-white'
                          : 'text-foreground/60 hover:bg-white/10 hover:text-foreground'
                      )}
                    >
                      <IconSvg paths={entry.paths} className="w-4 h-4" />
                      {isSelected && (
                        <span className="absolute top-0.5 right-0.5">
                          <svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                          </svg>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer: currently selected */}
          {currentEntry && (
            <div className="px-3 py-2 border-t border-border-subtle flex items-center gap-2">
              <IconSvg paths={currentEntry.paths} className="w-3.5 h-3.5 text-accent flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground">{currentEntry.label}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

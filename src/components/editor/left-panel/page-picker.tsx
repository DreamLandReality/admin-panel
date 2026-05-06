'use client'

import { ChevronDownIcon } from '@/components/icons'
import { cn } from '@/lib/utils/cn'
import type { PageEntry } from '@/lib/utils/page-list'

interface PagePickerProps {
  activePage: string
  currentPageName: string
  open: boolean
  onToggle: () => void
  onSelect: (pageId: string) => void
  staticPages: PageEntry[]
  dynamicParents: PageEntry[]
  dynamicChildren: PageEntry[]
}

export function PagePicker({
  activePage,
  currentPageName,
  open,
  onToggle,
  onSelect,
  staticPages,
  dynamicParents,
  dynamicChildren,
}: PagePickerProps) {
  return (
    <div className="relative border-b border-white/10 flex-shrink-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-foreground hover:bg-white/5 transition-colors"
      >
        <span className="truncate text-left font-medium">{currentPageName}</span>
        <ChevronDownIcon
          width={10}
          height={10}
          strokeWidth={1.4}
          className={cn('transition-transform duration-150 flex-shrink-0', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 bg-editor-bg border border-white/10 z-30 py-1 shadow-2xl">
          {staticPages.map((page) => (
            <button
              key={page.id}
              onClick={() => onSelect(page.id)}
              className={cn(
                'w-full flex items-center px-3 py-1.5 text-xs text-left transition-colors',
                activePage === page.id
                  ? 'text-foreground bg-white/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              {page.name}
            </button>
          ))}

          {dynamicParents.map((parent) => {
            const children = dynamicChildren.filter(
              (child) => child.dynamicPageId === parent.dynamicPageId
            )

            return (
              <div key={parent.id} className="border-t border-white/5 mt-1 pt-1">
                <button
                  onClick={() => onSelect(parent.id)}
                  className={cn(
                    'w-full flex items-center px-3 py-1.5 text-xs text-left transition-colors font-medium',
                    activePage === parent.id
                      ? 'text-foreground bg-white/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  )}
                >
                  {parent.name}
                </button>
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onSelect(child.id)}
                    className={cn(
                      'w-full flex items-center pl-6 pr-3 py-1.5 text-xs text-left transition-colors',
                      activePage === child.id
                        ? 'text-foreground bg-white/5'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    )}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

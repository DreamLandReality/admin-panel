import type { ReactNode } from 'react'
import {
  CheckCheckIcon as CheckCheck,
  CheckIcon as Check,
  ChevronDownIcon as ChevronDown,
  SearchIcon as Search,
} from '@/components/icons'
import { cn } from '@/lib/utils/cn'
import type { EnquiryProjectOption, EnquirySourceFilterOption, StatusFilter } from './enquiry-types'

function FilterBtn({
  label, active, open, onToggle, children,
}: {
  label: string; active: boolean; open: boolean; onToggle: () => void; children: ReactNode
}) {
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-2 h-9 px-4 rounded-xl border text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap',
          active
            ? 'border-foreground/25 bg-foreground/[0.06] text-foreground'
            : 'border-border text-foreground-muted hover:text-foreground hover:border-border-hover'
        )}
      >
        {label}
        <ChevronDown size={9} strokeWidth={2.5} className={cn('transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-dropdown min-w-[180px] rounded-lg border border-border bg-surface shadow-float overflow-hidden animate-fade-in">
          {children}
        </div>
      )}
    </div>
  )
}

function DropItem({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-2.5 text-body-sm flex items-center justify-between gap-3 transition-colors',
        selected ? 'bg-surface-active text-foreground font-medium' : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
      )}
    >
      {children}
      {selected && <Check size={10} strokeWidth={2.5} className="shrink-0" />}
    </button>
  )
}

interface EnquiryFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
  statusFilterOptions: EnquirySourceFilterOption[]
  statusOpen: boolean
  onToggleStatusOpen: () => void
  propertyFilter: string
  onPropertyFilterChange: (value: string) => void
  projects: EnquiryProjectOption[]
  propertyOpen: boolean
  onTogglePropertyOpen: () => void
  unreadCount: number
  resultCount: number
  hasActiveFilters: boolean
  canMarkRead: boolean
  onMarkAllRead: () => void
}

export function EnquiryFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusFilterOptions,
  statusOpen,
  onToggleStatusOpen,
  propertyFilter,
  onPropertyFilterChange,
  projects,
  propertyOpen,
  onTogglePropertyOpen,
  unreadCount,
  resultCount,
  hasActiveFilters,
  canMarkRead,
  onMarkAllRead,
}: EnquiryFilterBarProps) {
  return (
    <div className="flex items-center gap-2.5">
      <label className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border bg-transparent cursor-text flex-1 focus-within:border-border-hover transition-colors">
        <Search size={11} strokeWidth={2} className="text-foreground-muted/50 shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search clients or properties..."
          className="text-body-sm bg-transparent outline-none placeholder:text-foreground-muted/35 w-full text-foreground"
        />
      </label>

      <FilterBtn
        label={statusFilterOptions.find((o) => o.value === statusFilter)?.label ?? 'All Status'}
        active={statusFilter !== 'all'}
        open={statusOpen}
        onToggle={onToggleStatusOpen}
      >
        {statusFilterOptions.map((o) => (
          <DropItem
            key={o.value}
            selected={statusFilter === o.value}
            onClick={() => onStatusFilterChange(o.value)}
          >
            <span className="flex items-center gap-2">
              {o.value === 'unread' && unreadCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-warning/15 text-warning text-[9px] font-bold">
                  {unreadCount}
                </span>
              )}
              {o.label}
            </span>
          </DropItem>
        ))}
      </FilterBtn>

      <FilterBtn
        label={propertyFilter === 'all' ? 'All Properties' : (projects.find((p) => p.slug === propertyFilter)?.name ?? propertyFilter)}
        active={propertyFilter !== 'all'}
        open={propertyOpen}
        onToggle={onTogglePropertyOpen}
      >
        {[{ slug: 'all', name: 'All properties' }, ...projects].map((p) => (
          <DropItem
            key={p.slug}
            selected={propertyFilter === p.slug}
            onClick={() => onPropertyFilterChange(p.slug)}
          >
            {p.name}
          </DropItem>
        ))}
      </FilterBtn>

      {canMarkRead && unreadCount > 0 && (
        <>
          <span className="w-px h-4 bg-border shrink-0 mx-0.5" />
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border text-[9px] font-bold uppercase tracking-widest text-foreground-muted hover:text-foreground hover:border-border-hover transition-all whitespace-nowrap"
          >
            <CheckCheck size={10} strokeWidth={2} />
            Mark all read
          </button>
        </>
      )}

      {hasActiveFilters ? (
        <span className="ml-auto text-micro font-medium uppercase tracking-label text-foreground-muted/50 tabular-nums">
          {resultCount} result{resultCount !== 1 ? 's' : ''}
        </span>
      ) : null}
    </div>
  )
}

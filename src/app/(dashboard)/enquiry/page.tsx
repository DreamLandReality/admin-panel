'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { EmptyState } from '@/components/dashboard/empty-state'
import { EnquiryFilterBar } from '@/components/enquiry/enquiry-filters'
import { EnquiryPanel } from '@/components/enquiry/enquiry-panel'
import { Pagination } from '@/components/enquiry/enquiry-pagination'
import { EnquiryTable } from '@/components/enquiry/enquiry-table'
import type { LeadStatusFilter, SortCol, SortDir } from '@/components/enquiry/enquiry-types'
import { Skeleton } from '@/components/ui'
import { ErrorState } from '@/components/feedback/ErrorState'
import {
  useEnquiriesQuery,
  useUpdateEnquiryLeadProgressMutation,
} from '@/hooks/queries/use-enquiries-query'
import type { EnquiryQuery, LeadProgressUpdateInput } from '@/services/enquiry'
import { useHeaderStore } from '@/stores/header-store'

const PAGE_SIZE = 10
const GRID = 'grid-cols-[6px_minmax(0,2.1fr)_minmax(0,1.8fr)_minmax(0,1.6fr)_120px_120px_40px]'
const LEAD_STATUS_FILTER_OPTIONS: Array<{ value: LeadStatusFilter; label: string }> = [
  { value: 'all', label: 'All Leads' },
  { value: 'new', label: 'New' },
  { value: 'attended', label: 'Attended' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'closed', label: 'Closed' },
]

export default function EnquiryPage() {
  const [leadStatusFilter, setLeadStatusFilter] = useState<LeadStatusFilter>('all')
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [propOpen, setPropOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [followUpSavingId, setFollowUpSavingId] = useState<string | null>(null)

  const { setStats, clearStats } = useHeaderStore()
  const enquiryQuery = useMemo<EnquiryQuery>(() => ({
    page,
    pageSize: PAGE_SIZE,
    property: propertyFilter,
    search,
    sort: sortCol,
    dir: sortDir,
    leadStatus: leadStatusFilter,
  }), [leadStatusFilter, page, propertyFilter, search, sortCol, sortDir])
  const { data, isLoading, error, refetch } = useEnquiriesQuery(enquiryQuery)
  const leadProgressMutation = useUpdateEnquiryLeadProgressMutation()
  const enquiries = useMemo(() => data?.data ?? [], [data?.data])
  const totalCount = data?.totalCount ?? 0
  const newLeadCount = data?.newLeadCount ?? 0
  const reloadEnquiries = useCallback(() => { void refetch() }, [refetch])

  useEffect(() => {
    if (!isLoading && !error) {
      setStats([
        { label: 'Total', value: totalCount },
        { label: 'New', value: newLeadCount, colorClass: newLeadCount > 0 ? 'text-accent' : undefined },
      ])
    }
    return () => clearStats()
  }, [clearStats, error, isLoading, newLeadCount, setStats, totalCount])

  const handleLeadProgressUpdate = useCallback(async (id: string, input: LeadProgressUpdateInput) => {
    setFollowUpSavingId(id)
    try {
      await leadProgressMutation.mutateAsync({ id, input })
    } finally {
      setFollowUpSavingId(null)
    }
  }, [leadProgressMutation])

  useEffect(() => {
    if (!propOpen && !statusOpen) return
    const close = () => { setPropOpen(false); setStatusOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [propOpen, statusOpen])

  const resetPage = useCallback(() => setPage(1), [])

  const handleSort = useCallback((col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
    setPage(1)
  }, [sortCol])

  useEffect(() => {
    if (!selectedId || isLoading) return
    if (!enquiries.some((enquiry) => enquiry.id === selectedId)) {
      setSelectedId(null)
    }
  }, [enquiries, isLoading, selectedId])

  const projects = data?.properties ?? []

  const selectedEnquiry = enquiries.find((e) => e.id === selectedId) ?? null
  const hasActiveFilters = search !== '' || leadStatusFilter !== 'all' || propertyFilter !== 'all'

  if (isLoading) {
    return (
      <div className="flex flex-col animate-fade-in gap-6">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 flex-1 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <div className={cn('grid gap-4 px-4 py-2 bg-surface-hover/50 border-b border-border', GRID)}>
            {['', ...['w-16', 'w-14', 'w-16', 'w-12', 'w-14', '']].map((w, i) => (
              <Skeleton key={i} className={cn('h-2.5 rounded', w)} />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn('grid gap-4 px-4 py-4 border-b border-border last:border-0 items-center', GRID)}>
              <div />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-2.5 w-48 rounded" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-36 rounded" />
                <Skeleton className="h-2.5 w-20 rounded" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-28 rounded" />
                <Skeleton className="h-3.5 w-16 rounded-sm" />
              </div>
              <Skeleton className="h-2.5 w-20 rounded" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <div />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        heading="Failed to load enquiries"
        description={error instanceof Error ? error.message : 'Failed to load'}
        onRetry={reloadEnquiries}
        className="h-64"
      />
    )
  }

  if (totalCount === 0 && !hasActiveFilters) {
    return (
      <EmptyState
        heading="No enquiries yet"
        description="When visitors enquire from your deployed property sites, their messages and follow-up status will appear here."
      />
    )
  }

  return (
    <>
      <div className={cn(
        'flex flex-col animate-fade-in gap-6 transition-[padding] duration-300 ease-spring',
        selectedId && 'pr-[460px]'
      )}>
        <EnquiryFilterBar
          search={search}
          onSearchChange={(value) => { setSearch(value); resetPage() }}
          leadStatusFilter={leadStatusFilter}
          onLeadStatusFilterChange={(value) => { setLeadStatusFilter(value); setStatusOpen(false); resetPage() }}
          leadStatusFilterOptions={LEAD_STATUS_FILTER_OPTIONS}
          statusOpen={statusOpen}
          onToggleStatusOpen={() => { setStatusOpen((v) => !v); setPropOpen(false) }}
          propertyFilter={propertyFilter}
          onPropertyFilterChange={(value) => { setPropertyFilter(value); setPropOpen(false); resetPage() }}
          projects={projects}
          propertyOpen={propOpen}
          onTogglePropertyOpen={() => { setPropOpen((v) => !v); setStatusOpen(false) }}
          resultCount={totalCount}
          hasActiveFilters={hasActiveFilters}
        />

        <EnquiryTable
          enquiries={enquiries}
          selectedId={selectedId}
          gridClassName={GRID}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={handleSort}
          onSelect={setSelectedId}
        />

        <Pagination
          page={page}
          total={totalCount}
          pageSize={PAGE_SIZE}
          onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
        />
      </div>

      <EnquiryPanel
        enquiry={selectedEnquiry}
        onClose={() => setSelectedId(null)}
        onUpdateLeadProgress={handleLeadProgressUpdate}
        followUpSaving={followUpSavingId === selectedEnquiry?.id}
      />
    </>
  )
}

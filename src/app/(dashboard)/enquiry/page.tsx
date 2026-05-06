'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { EmptyState } from '@/components/dashboard/empty-state'
import { EnquiryFilterBar } from '@/components/enquiry/enquiry-filters'
import { EnquiryPanel } from '@/components/enquiry/enquiry-panel'
import { Pagination } from '@/components/enquiry/enquiry-pagination'
import { EnquiryTable } from '@/components/enquiry/enquiry-table'
import type { StatusFilter, SortCol, SortDir } from '@/components/enquiry/enquiry-types'
import { Skeleton } from '@/components/ui'
import { ErrorState } from '@/components/feedback/ErrorState'
import {
  useEnquiriesQuery,
  useMarkEnquiryReadMutation,
  useUpdateEnquiryFollowUpMutation,
} from '@/hooks/queries/use-enquiries-query'
import { getUserRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/client'
import type { EnquiryQuery, FollowUpUpdateInput } from '@/services/enquiry'
import { useHeaderStore } from '@/stores/header-store'

const PAGE_SIZE = 10
const GRID = 'grid-cols-[6px_minmax(0,2.5fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_130px_110px_40px]'

export default function EnquiryPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [propOpen, setPropOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [followUpSavingId, setFollowUpSavingId] = useState<string | null>(null)
  const [canMarkRead, setCanMarkRead] = useState(false)

  const { setStats, clearStats } = useHeaderStore()
  const supabase = useMemo(() => createClient(), [])
  const enquiryQuery = useMemo<EnquiryQuery>(() => ({
    page,
    pageSize: PAGE_SIZE,
    status: statusFilter,
    property: propertyFilter,
    search,
    sort: sortCol,
    dir: sortDir,
  }), [page, propertyFilter, search, sortCol, sortDir, statusFilter])
  const { data, isLoading, error, refetch } = useEnquiriesQuery(enquiryQuery)
  const markReadMutation = useMarkEnquiryReadMutation()
  const followUpMutation = useUpdateEnquiryFollowUpMutation()
  const enquiries = useMemo(() => data?.data ?? [], [data?.data])
  const totalCount = data?.totalCount ?? 0
  const unreadCount = data?.unreadCount ?? 0
  const reloadEnquiries = useCallback(() => { void refetch() }, [refetch])

  useEffect(() => {
    if (!isLoading && !error) {
      setStats([
        { label: 'Total', value: totalCount },
        { label: 'Unread', value: unreadCount, colorClass: unreadCount > 0 ? 'text-accent' : undefined },
      ])
    }
    return () => clearStats()
  }, [clearStats, error, isLoading, setStats, totalCount, unreadCount])

  const markRead = useCallback(async (id: string) => {
    if (!canMarkRead) return
    if (markingId === id) return
    setMarkingId(id)
    try {
      await markReadMutation.mutateAsync(id)
    } finally {
      setMarkingId(null)
    }
  }, [canMarkRead, markReadMutation, markingId])

  const markAllRead = useCallback(async () => {
    if (!canMarkRead) return
    const ids = enquiries.filter((e) => !e.is_read).map((e) => e.id)
    if (!ids.length) return
    await Promise.all(ids.map((id) => markReadMutation.mutateAsync(id)))
  }, [canMarkRead, enquiries, markReadMutation])

  const handleFollowUpUpdate = useCallback(async (id: string, input: FollowUpUpdateInput) => {
    setFollowUpSavingId(id)
    try {
      await followUpMutation.mutateAsync({ id, input })
    } finally {
      setFollowUpSavingId(null)
    }
  }, [followUpMutation])

  useEffect(() => {
    if (!propOpen && !statusOpen) return
    const close = () => { setPropOpen(false); setStatusOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [propOpen, statusOpen])

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) setCanMarkRead(getUserRole(user) === 'admin')
    })
    return () => { mounted = false }
  }, [supabase])

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

  const projects = useMemo(() => Array.from(
    new Map(enquiries.map((e) => [
      e.deployment_slug,
      { slug: e.deployment_slug, name: e.deployments?.project_name ?? e.deployment_slug },
    ])).values()
  ), [enquiries])

  const sourceFilterOptions = useMemo(() => Array.from(
    new Map(enquiries.map((enquiry) => [
      enquiry.source.id,
      { value: `source:${enquiry.source.id}` as StatusFilter, label: enquiry.source.label },
    ])).values()
  ).sort((a, b) => a.label.localeCompare(b.label)), [enquiries])

  const statusFilterOptions = useMemo(() => [
    { value: 'all' as const, label: 'All' },
    { value: 'unread' as const, label: 'New / Unread' },
    ...sourceFilterOptions,
  ], [sourceFilterOptions])

  const selectedEnquiry = enquiries.find((e) => e.id === selectedId) ?? null
  const hasActiveFilters = search !== '' || statusFilter !== 'all' || propertyFilter !== 'all'

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
        description="When visitors submit the contact or price unlock form on your deployed sites, their messages will appear here."
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
          statusFilter={statusFilter}
          onStatusFilterChange={(value) => { setStatusFilter(value); setStatusOpen(false); resetPage() }}
          statusFilterOptions={statusFilterOptions}
          statusOpen={statusOpen}
          onToggleStatusOpen={() => { setStatusOpen((v) => !v); setPropOpen(false) }}
          propertyFilter={propertyFilter}
          onPropertyFilterChange={(value) => { setPropertyFilter(value); setPropOpen(false); resetPage() }}
          projects={projects}
          propertyOpen={propOpen}
          onTogglePropertyOpen={() => { setPropOpen((v) => !v); setStatusOpen(false) }}
          unreadCount={unreadCount}
          resultCount={totalCount}
          hasActiveFilters={hasActiveFilters}
          canMarkRead={canMarkRead}
          onMarkAllRead={markAllRead}
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
        onMarkRead={(id) => {
          void markRead(id)
        }}
        canMarkRead={canMarkRead}
        marking={markingId}
        onUpdateFollowUp={handleFollowUpUpdate}
        followUpSaving={followUpSavingId === selectedEnquiry?.id}
      />
    </>
  )
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { draftService } from '@/services/draft'
import { queryKeys } from './keys'
import { unwrapResult } from './utils'

export function useDraftsQuery() {
  return useQuery({
    queryKey: queryKeys.drafts.all,
    queryFn: ({ signal }) => unwrapResult(draftService.list({ signal })),
  })
}

export function useDraftQuery(id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.drafts.detail(id) : ['drafts', 'empty'],
    queryFn: ({ signal }) => unwrapResult(draftService.get(id ?? '', { signal })),
    enabled: !!id,
  })
}

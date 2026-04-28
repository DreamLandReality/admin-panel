'use client'

import { useQuery } from '@tanstack/react-query'
import { templateService } from '@/services/template'
import { queryKeys } from './keys'
import { unwrapResult } from './utils'

export function useTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.templates,
    queryFn: ({ signal }) => unwrapResult(templateService.list({ signal })),
  })
}

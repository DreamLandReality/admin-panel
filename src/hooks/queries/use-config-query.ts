'use client'

import { useQuery } from '@tanstack/react-query'
import { getAppConfig } from '@/services/config'
import { queryKeys } from './keys'
import { unwrapResult } from './utils'

export function useConfigQuery() {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: ({ signal }) => unwrapResult(getAppConfig({ signal })),
    staleTime: 5 * 60_000,
  })
}

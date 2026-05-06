'use client'

import { useQuery } from '@tanstack/react-query'
import { deploymentService } from '@/services/deployment'
import { queryKeys } from './keys'
import { unwrapResult } from './utils'

type UseDeploymentQueryOptions = {
  enabled?: boolean
  refetchInterval?: number | false
}

export function useActiveDeploymentGateQuery() {
  return useQuery({
    queryKey: queryKeys.deployments.activeGate,
    queryFn: ({ signal }) => unwrapResult(deploymentService.getActive({ signal })),
  })
}

export function useDeploymentQuery(id: string | null, options: UseDeploymentQueryOptions = {}) {
  return useQuery({
    queryKey: id ? queryKeys.deployments.detail(id) : ['deployments', 'empty'],
    queryFn: ({ signal }) => unwrapResult(deploymentService.get(id ?? '', { signal })),
    enabled: !!id && (options.enabled ?? true),
    refetchInterval: options.refetchInterval,
  })
}

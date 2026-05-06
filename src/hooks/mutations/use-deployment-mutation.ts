'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { startDeployment } from '@/services/deploy'
import { deploymentService } from '@/services/deployment'
import { queryKeys } from '@/hooks/queries/keys'
import { unwrapResult } from '@/hooks/queries/utils'
import type { SiteData } from '@/types'
import type { StartDeployInput } from '@/services/types'

const EMPTY_SITE_DATA: SiteData = {}

export function useCancelDeploymentMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (deploymentId: string) =>
      unwrapResult(deploymentService.update(deploymentId, {
        action: 'cancel',
        siteData: EMPTY_SITE_DATA,
      })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.deployments.activeGate })
    },
  })
}

export function useStartDeploymentMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: StartDeployInput) => startDeployment(input),
    onSuccess: (result) => {
      if (!result.ok) return
      void queryClient.invalidateQueries({ queryKey: queryKeys.deployments.active })
      void queryClient.invalidateQueries({ queryKey: queryKeys.deployments.activeGate })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.deployments.detail(result.data.deploymentId),
      })
    },
  })
}

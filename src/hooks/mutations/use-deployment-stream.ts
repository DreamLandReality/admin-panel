'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { connectDeploymentStream } from '@/services/deploy-stream'
import type { DeployEvent } from '@/types'

type UseDeploymentStreamQueryOptions = { onEvent: (event: DeployEvent) => void; onFallback?: (deploymentId: string) => void }

export function useDeploymentStreamQuery(options: UseDeploymentStreamQueryOptions) {
  const handlersRef = useRef(options)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => { handlersRef.current = options }, [options])

  const { mutateAsync, isPending, error, reset } = useMutation({
    mutationFn: async (deploymentId: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const result = await connectDeploymentStream(deploymentId, {
        onEvent: (event) => handlersRef.current.onEvent(event),
      }, { signal: controller.signal })
      if (abortRef.current === controller) {
        abortRef.current = null
      }
      if (result.status === 'fallback') {
        handlersRef.current.onFallback?.(deploymentId)
      }
      return result
    },
  })

  const cancel = useCallback(() => { abortRef.current?.abort(); abortRef.current = null }, [])
  useEffect(() => cancel, [cancel])
  const connect = useCallback((deploymentId: string) => mutateAsync(deploymentId), [mutateAsync])
  return { connect, cancel, isPending, error, reset }
}

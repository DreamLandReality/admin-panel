'use client'

import { useMutation } from '@tanstack/react-query'
import { aiService } from '@/services/ai'
import type { ParseProjectInput, ServiceRequestOptions } from '@/services/types'

type ParseProjectMutationInput = ParseProjectInput & ServiceRequestOptions

export function useAiParseMutation() {
  return useMutation({
    mutationFn: ({ signal, ...input }: ParseProjectMutationInput) =>
      aiService.parseProject(input, { signal }),
  })
}

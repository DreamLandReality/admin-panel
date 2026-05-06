'use client'

import { useMutation } from '@tanstack/react-query'
import { templateService } from '@/services/template'
import type { ServiceRequestOptions } from '@/services/types'

type ProjectNameCheckInput = {
  name: string
} & ServiceRequestOptions

export function useProjectNameCheckMutation() {
  return useMutation({
    mutationFn: ({ name, signal }: ProjectNameCheckInput) =>
      templateService.checkProjectName(name, { signal }),
  })
}

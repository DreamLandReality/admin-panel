'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enquiryService } from '@/services/enquiry'
import { queryKeys } from './keys'
import { unwrapResult } from './utils'

export function useEnquiriesQuery() {
  return useQuery({
    queryKey: queryKeys.enquiries,
    queryFn: ({ signal }) => unwrapResult(enquiryService.list({ signal })),
  })
}

export function useMarkEnquiryReadMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrapResult(enquiryService.markRead(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.enquiries }),
  })
}

export function useVoiceCallActionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'retry' | 'cancel' }) =>
      unwrapResult(enquiryService.updateVoiceCall(id, { action })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.enquiries }),
  })
}

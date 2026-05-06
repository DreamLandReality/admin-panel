'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enquiryService } from '@/services/enquiry'
import { queryKeys } from './keys'
import { unwrapResult } from './utils'
import type { EnquiryQuery, FollowUpUpdateInput } from '@/services/enquiry'

export function useEnquiriesQuery(query: EnquiryQuery) {
  return useQuery({
    queryKey: queryKeys.enquiries.list(query),
    queryFn: ({ signal }) => unwrapResult(enquiryService.list(query, { signal })),
  })
}

export function useMarkEnquiryReadMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrapResult(enquiryService.markRead(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.enquiries.all }),
  })
}

export function useUpdateEnquiryFollowUpMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FollowUpUpdateInput }) =>
      unwrapResult(enquiryService.updateFollowUp(id, input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.enquiries.all }),
  })
}

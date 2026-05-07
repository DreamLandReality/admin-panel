'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enquiryService } from '@/services/enquiry'
import { queryKeys } from './keys'
import { unwrapResult } from './utils'
import type { EnquiryQuery, LeadProgressUpdateInput } from '@/services/enquiry'

export function useEnquiriesQuery(query: EnquiryQuery) {
  return useQuery({
    queryKey: queryKeys.enquiries.list(query),
    queryFn: ({ signal }) => unwrapResult(enquiryService.list(query, { signal })),
  })
}

export function useUpdateEnquiryLeadProgressMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: LeadProgressUpdateInput }) =>
      unwrapResult(enquiryService.updateLeadProgress(id, input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.enquiries.all }),
  })
}

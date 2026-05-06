'use client'

import { useQuery } from '@tanstack/react-query'
import { enquiryService } from '@/services/enquiry'
import { queryKeys } from './keys'
import { unwrapResult } from './utils'

export function useEnquirySummaryQuery() {
  return useQuery({
    queryKey: queryKeys.enquiries.summary,
    queryFn: ({ signal }) => unwrapResult(enquiryService.summary({ signal })),
  })
}

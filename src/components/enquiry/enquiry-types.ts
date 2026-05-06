import type { EnquirySortColumn, EnquirySortDirection, EnquiryStatusFilter } from '@/services/enquiry'

export type StatusFilter = EnquiryStatusFilter
export type SortCol = EnquirySortColumn
export type SortDir = EnquirySortDirection

export interface EnquiryProjectOption {
  slug: string
  name: string
}

export interface EnquirySourceFilterOption {
  value: StatusFilter
  label: string
}

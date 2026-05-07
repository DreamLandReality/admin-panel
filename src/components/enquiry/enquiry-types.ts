import type { EnquirySortColumn, EnquirySortDirection, LeadStatus } from '@/services/enquiry'

export type LeadStatusFilter = 'all' | LeadStatus
export type SortCol = EnquirySortColumn
export type SortDir = EnquirySortDirection

export interface EnquiryProjectOption {
  slug: string
  name: string
}

export interface EnquiryLeadStatusFilterOption {
  value: LeadStatusFilter
  label: string
}

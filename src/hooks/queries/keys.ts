import type { EnquiryQuery } from '@/services/enquiry'

export const queryKeys = {
  config: ['config'] as const,
  templates: ['templates'] as const,
  drafts: {
    all: ['drafts'] as const,
    detail: (id: string) => ['drafts', id] as const,
  },
  deployments: {
    active: ['deployments', 'active'] as const,
    activeGate: ['deployments', 'active', 'gate'] as const,
    detail: (id: string) => ['deployments', id] as const,
  },
  enquiries: {
    all: ['enquiries'] as const,
    list: (query: EnquiryQuery) => ['enquiries', 'list', query] as const,
    summary: ['enquiries', 'summary'] as const,
  },
}

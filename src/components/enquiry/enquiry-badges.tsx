import { PhoneCallIcon as PhoneCall } from '@/components/icons'
import { cn } from '@/lib/utils/cn'
import { isLeadSourceAccent } from './enquiry-format'
import type { CallStatus, Enquiry, LeadStatus } from '@/services/enquiry'

export function TypePill({ source }: { source: Enquiry['source'] }) {
  const isAccent = isLeadSourceAccent(source)
  const isUnknown = !source.known
  return (
    <span className={cn(
      'inline-flex items-center h-[16px] px-1.5 rounded-sm text-[9px] font-bold uppercase tracking-widest border leading-none',
      isUnknown
        ? 'bg-error/12 border-error/25 text-error'
        : isAccent
        ? 'bg-warning/12 border-warning/20 text-warning'
        : 'bg-foreground/[0.045] border-border text-foreground-muted'
    )}>
      {source.label}
    </span>
  )
}

const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-foreground/[0.055] border-border text-foreground' },
  attended: { label: 'Attended', color: 'bg-success/12 border-success/25 text-success' },
  follow_up: { label: 'Follow-up', color: 'bg-warning/12 border-warning/25 text-warning' },
  closed: { label: 'Closed', color: 'bg-foreground/[0.04] border-border text-foreground-muted' },
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const config = LEAD_STATUS_CONFIG[status]
  return (
    <span className={cn(
      'inline-flex items-center h-5 px-2 rounded-full text-[9px] font-bold uppercase tracking-widest border whitespace-nowrap',
      config.color
    )}>
      {config.label}
    </span>
  )
}

const CALL_STATUS_CONFIG: Record<CallStatus, { label: string; color: string } | null> = {
  pending: null,
  skipped: null,
  scheduled: { label: 'Scheduled', color: 'bg-info/12 border-info/25 text-info' },
  calling:   { label: 'Calling', color: 'bg-warning/12 border-warning/25 text-warning' },
  completed: { label: 'Completed', color: 'bg-success/12 border-success/25 text-success' },
  no_answer: { label: 'No Answer', color: 'bg-warning/12 border-warning/25 text-warning' },
  failed:    { label: 'Failed', color: 'bg-error/12 border-error/25 text-error' },
  cancelled: { label: 'Cancelled', color: 'bg-foreground/[0.04] border-border text-foreground-muted' },
}

export function CallStatusBadge({ status }: { status: CallStatus }) {
  const config = CALL_STATUS_CONFIG[status]
  if (!config) return null
  return (
    <span className={cn(
      'inline-flex items-center gap-1 h-5 px-2 rounded-full text-[9px] font-bold uppercase tracking-widest border whitespace-nowrap',
      config.color
    )}>
      <PhoneCall size={8} strokeWidth={2.5} className="shrink-0" />
      {config.label}
    </span>
  )
}

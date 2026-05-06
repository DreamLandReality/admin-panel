import { PhoneCallIcon as PhoneCall } from '@/components/icons'
import { cn } from '@/lib/utils/cn'
import { isLeadSourceAccent } from './enquiry-format'
import type { CallStatus, Enquiry } from '@/services/enquiry'

export function StatusBadge({ isRead, source }: { isRead: boolean; source?: Enquiry['source'] }) {
  const isAccent = isLeadSourceAccent(source)
  if (!isRead && isAccent) {
    return (
      <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[9px] font-bold uppercase tracking-widest bg-warning/10 border border-warning/20 text-warning whitespace-nowrap">
        <span className="w-1 h-1 rounded-full bg-warning shrink-0" />
        {source?.label ?? 'New'}
      </span>
    )
  }
  if (!isRead) {
    return (
      <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[9px] font-bold uppercase tracking-widest bg-foreground/[0.06] border border-border text-foreground whitespace-nowrap">
        <span className="w-1 h-1 rounded-full bg-foreground/50 shrink-0" />
        New
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[9px] font-bold uppercase tracking-widest bg-foreground/[0.03] border border-border/50 text-foreground-muted/60 whitespace-nowrap">
      Read
    </span>
  )
}

export function TypePill({ source }: { source: Enquiry['source'] }) {
  const isAccent = isLeadSourceAccent(source)
  const isUnknown = !source.known
  return (
    <span className={cn(
      'inline-flex items-center h-[16px] px-1.5 rounded-sm text-[9px] font-bold uppercase tracking-widest border leading-none',
      isUnknown
        ? 'bg-error/10 border-error/20 text-error'
        : isAccent
        ? 'bg-warning/[0.07] border-warning/15 text-warning'
        : 'bg-foreground/[0.04] border-border/60 text-foreground-muted/70'
    )}>
      {source.label}
    </span>
  )
}

const CALL_STATUS_CONFIG: Record<CallStatus, { label: string; color: string } | null> = {
  pending: null,
  skipped: null,
  scheduled: { label: 'Scheduled', color: 'bg-info/10 border-info/20 text-info' },
  calling:   { label: 'Calling', color: 'bg-warning/10 border-warning/20 text-warning' },
  completed: { label: 'Completed', color: 'bg-success/10 border-success/20 text-success' },
  no_answer: { label: 'No Answer', color: 'bg-warning/10 border-warning/20 text-warning' },
  failed:    { label: 'Failed', color: 'bg-error/10 border-error/20 text-error' },
  cancelled: { label: 'Cancelled', color: 'bg-foreground/[0.04] border-border/60 text-foreground-muted/60' },
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

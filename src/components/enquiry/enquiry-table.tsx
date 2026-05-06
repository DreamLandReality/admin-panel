import {
  ArrowRightIcon as ArrowRight,
  MailIcon as Mail,
  PhoneIcon as Phone,
} from '@/components/icons'
import { cn } from '@/lib/utils/cn'
import { CallStatusBadge, StatusBadge, TypePill } from './enquiry-badges'
import { formatDate, isLeadSourceAccent, timeAgo } from './enquiry-format'
import { TH } from './table-header'
import type { Enquiry } from '@/services/enquiry'
import type { SortCol, SortDir } from './enquiry-types'

interface EnquiryTableProps {
  enquiries: Enquiry[]
  selectedId: string | null
  gridClassName: string
  sortCol: SortCol
  sortDir: SortDir
  onSort: (col: SortCol) => void
  onSelect: (id: string | null) => void
}

export function EnquiryTable({
  enquiries,
  selectedId,
  gridClassName,
  sortCol,
  sortDir,
  onSort,
  onSelect,
}: EnquiryTableProps) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className={cn('grid gap-4 px-4 py-2 bg-surface-hover/40 border-b border-border items-center', gridClassName)}>
        <div />
        <TH sortable col="name" active={sortCol === 'name'} dir={sortDir} onSort={onSort}>
          Client
        </TH>
        <TH>Contact</TH>
        <TH sortable col="property" active={sortCol === 'property'} dir={sortDir} onSort={onSort}>
          Property
        </TH>
        <TH sortable col="date" active={sortCol === 'date'} dir={sortDir} onSort={onSort}>
          Submitted
        </TH>
        <TH>Status</TH>
        <div />
      </div>

      {enquiries.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted">
            No enquiries match your filter
          </p>
        </div>
      ) : (
        enquiries.map((enquiry) => {
          const projectName = enquiry.deployments?.project_name ?? enquiry.deployment_slug
          const isSourceAccent = isLeadSourceAccent(enquiry.source)
          const isUnread = !enquiry.is_read
          const isSelected = selectedId === enquiry.id

          return (
            <div
              key={enquiry.id}
              className={cn(
                'relative border-b border-border/50 last:border-0 transition-colors duration-150 cursor-pointer group',
                isSelected
                  ? 'bg-surface-active'
                  : isUnread && isSourceAccent
                    ? 'bg-warning/[0.015] hover:bg-warning/[0.03]'
                    : isUnread
                      ? 'bg-foreground/[0.008] hover:bg-surface-hover'
                      : 'hover:bg-surface-hover'
              )}
              onClick={() => onSelect(isSelected ? null : enquiry.id)}
            >
              <div className={cn(
                'absolute left-0 inset-y-0 w-[3px] transition-all duration-200',
                isSelected
                  ? 'bg-foreground/40'
                  : isUnread
                    ? isSourceAccent ? 'bg-warning/70' : 'bg-foreground/20'
                    : 'bg-transparent'
              )} />

              <div className={cn('grid gap-4 px-4 py-4 items-center', gridClassName)}>
                <div className="flex justify-center">
                  {isUnread && (
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      isSourceAccent
                        ? 'bg-warning shadow-lead-dot'
                        : 'bg-foreground/30'
                    )} />
                  )}
                </div>

                <div className="min-w-0">
                  <p className={cn(
                    'font-serif leading-tight tracking-tight truncate transition-all duration-200',
                    isUnread ? 'text-[17px] text-foreground' : 'text-[15px] text-foreground/55'
                  )}>
                    {enquiry.name}
                  </p>
                  {enquiry.message && (
                    <p className={cn(
                      'text-micro font-medium truncate mt-0.5 transition-colors',
                      isUnread ? 'text-foreground-muted/70' : 'text-foreground-muted/40'
                    )}>
                      {enquiry.message}
                    </p>
                  )}
                </div>

                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-1.5 text-micro font-medium uppercase tracking-label text-foreground-muted truncate">
                    <Mail size={9} strokeWidth={2} className="shrink-0" />
                    {enquiry.email}
                  </p>
                  {enquiry.phone && (
                    <p className="flex items-center gap-1.5 text-micro font-medium uppercase tracking-label text-foreground-muted/60 truncate">
                      <Phone size={9} strokeWidth={2} className="shrink-0" />
                      {enquiry.phone}
                    </p>
                  )}
                </div>

                <div className="min-w-0 space-y-1.5">
                  <p className={cn(
                    'font-serif text-[15px] leading-tight tracking-tight truncate',
                    isSourceAccent ? 'text-warning' : 'text-foreground'
                  )}>
                    {projectName}
                  </p>
                  <TypePill source={enquiry.source} />
                </div>

                <div>
                  <p className="text-micro uppercase tracking-label tabular-nums text-foreground-muted/70">
                    {formatDate(enquiry.created_at)}
                  </p>
                  <p className="text-micro tabular-nums text-foreground-muted/40 mt-0.5">
                    {timeAgo(enquiry.created_at)}
                  </p>
                </div>

                <div className="space-y-1">
                  <StatusBadge isRead={enquiry.is_read} source={enquiry.source} />
                  <CallStatusBadge status={enquiry.call_status} />
                </div>

                <div className="flex justify-end">
                  <span className="w-7 h-7 rounded-md border border-border/50 flex items-center justify-center text-foreground-muted/40 group-hover:text-foreground group-hover:border-border-hover transition-all duration-150">
                    <ArrowRight size={11} strokeWidth={2} />
                  </span>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

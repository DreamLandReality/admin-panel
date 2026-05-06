'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CheckIcon as Check,
  ExternalLinkIcon as ExternalLink,
  MailIcon as Mail,
  PhoneIcon as Phone,
  XIcon as X,
} from '@/components/icons'
import { cn } from '@/lib/utils/cn'
import { StatusBadge, TypePill } from './enquiry-badges'
import { formatDate, isLeadSourceAccent, timeAgo } from './enquiry-format'
import type { Enquiry, FollowUpUpdateInput, LeadStatus } from '@/services/enquiry'

const LEAD_STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'attended', label: 'Attended' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'closed', label: 'Closed' },
]

const CALL_STATUS_LABELS: Record<Enquiry['call_status'], string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  calling: 'Calling',
  completed: 'Completed',
  no_answer: 'No answer',
  failed: 'Failed',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
}

const HANDLED_BY_LABELS: Record<NonNullable<Enquiry['attended_by']>, string> = {
  automated: 'Automated call',
  manual: 'Manual follow-up',
}

interface EnquiryPanelProps {
  enquiry: Enquiry | null
  onClose: () => void
  onMarkRead: (id: string) => void
  canMarkRead: boolean
  marking: string | null
  onUpdateFollowUp: (id: string, input: FollowUpUpdateInput) => Promise<void>
  followUpSaving: boolean
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getCallStatusText(enquiry: Enquiry) {
  if (enquiry.call_status === 'scheduled' && enquiry.call_scheduled_for) {
    return `Scheduled for ${formatTime(enquiry.call_scheduled_for)}`
  }
  if (enquiry.call_status === 'completed' && enquiry.call_completed_at) {
    return `Completed at ${formatTime(enquiry.call_completed_at)}`
  }
  return CALL_STATUS_LABELS[enquiry.call_status]
}

export function EnquiryPanel({
  enquiry,
  onClose,
  onMarkRead,
  canMarkRead,
  marking,
  onUpdateFollowUp,
  followUpSaving,
}: EnquiryPanelProps) {
  const [leadStatus, setLeadStatus] = useState<LeadStatus>('new')
  const [callNotes, setCallNotes] = useState('')
  const isOpen = !!enquiry
  const isSourceAccent = isLeadSourceAccent(enquiry?.source)
  const isUnread = enquiry ? !enquiry.is_read : false
  const projectName = enquiry
    ? (enquiry.deployments?.project_name ?? enquiry.deployment_slug)
    : ''
  const handledBy = enquiry?.attended_by
    ? HANDLED_BY_LABELS[enquiry.attended_by]
    : 'Not handled yet'
  const hasFollowUpChanges = useMemo(() => {
    if (!enquiry) return false
    return leadStatus !== enquiry.lead_status || callNotes !== (enquiry.call_notes ?? '')
  }, [callNotes, enquiry, leadStatus])

  useEffect(() => {
    if (!enquiry) return
    setLeadStatus(enquiry.lead_status)
    setCallNotes(enquiry.call_notes ?? '')
  }, [enquiry])

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[34] transition-opacity duration-300',
          isOpen ? 'pointer-events-auto' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      <div className={cn(
        'fixed top-0 right-0 h-full w-[440px] bg-background border-l border-border shadow-modal z-[35] flex flex-col transition-transform duration-300 ease-spring',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}>
        {enquiry && (
          <>
            <div className={cn(
              'flex items-start justify-between px-7 pt-7 pb-6 border-b border-border shrink-0',
              isSourceAccent && isUnread && 'border-warning/10'
            )}>
              <div className={cn(
                'absolute left-0 top-8 h-12 w-[3px] rounded-r-full',
                isUnread ? isSourceAccent ? 'bg-warning' : 'bg-foreground/30' : 'bg-transparent'
              )} />

              <div className="min-w-0 pr-4">
                <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-2">
                  {formatDate(enquiry.created_at)} · {timeAgo(enquiry.created_at)}
                </p>
                <h2 className="font-serif text-[24px] leading-tight text-foreground mb-2">
                  {enquiry.name}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge isRead={enquiry.is_read} source={enquiry.source} />
                  <TypePill source={enquiry.source} />
                </div>
              </div>

              <button
                onClick={onClose}
                className="h-7 w-7 rounded-lg border border-border flex items-center justify-center text-foreground-muted hover:text-foreground hover:border-border-hover transition-colors shrink-0 mt-0.5"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">
              <div>
                <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-3">
                  Contact
                </p>
                <div className="space-y-2">
                  <a
                    href={`mailto:${enquiry.email}`}
                    className="flex items-center gap-2.5 text-body-sm text-foreground hover:text-foreground/70 transition-colors group"
                  >
                    <div className="w-6 h-6 rounded-md bg-foreground/[0.05] border border-border flex items-center justify-center shrink-0">
                      <Mail size={10} strokeWidth={1.75} />
                    </div>
                    {enquiry.email}
                  </a>
                  {enquiry.phone && (
                    <a
                      href={`tel:${enquiry.phone}`}
                      className="flex items-center gap-2.5 text-body-sm text-foreground hover:text-foreground/70 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-md bg-foreground/[0.05] border border-border flex items-center justify-center shrink-0">
                        <Phone size={10} strokeWidth={1.75} />
                      </div>
                      {enquiry.phone}
                    </a>
                  )}
                </div>
              </div>

              <div>
                <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-3">
                  Property
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm text-foreground font-medium">{projectName}</span>
                  <TypePill source={enquiry.source} />
                </div>
              </div>

              <div>
                <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-3">
                  Message
                </p>
                {enquiry.message ? (
                  <blockquote className={cn(
                    'border-l-2 pl-4 py-1',
                    isSourceAccent ? 'border-warning/30' : 'border-border'
                  )}>
                    <p className="font-serif text-[14px] italic text-foreground/65 leading-relaxed whitespace-pre-wrap">
                      &ldquo;{enquiry.message}&rdquo;
                    </p>
                  </blockquote>
                ) : (
                  <p className="text-body-sm text-foreground-muted italic">No message provided.</p>
                )}
              </div>

              <div>
                <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-3">
                  Submitted from
                </p>
                <a
                  href={enquiry.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-start gap-1.5 text-body-sm text-foreground/50 hover:text-foreground transition-colors break-all"
                >
                  {enquiry.source_url}
                  <ExternalLink size={10} strokeWidth={1.75} className="shrink-0 mt-0.5" />
                </a>
              </div>

              <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
                <div>
                  <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-1.5">
                    Call status
                  </p>
                  <p className="text-body-sm text-foreground">{getCallStatusText(enquiry)}</p>
                </div>
                <div>
                  <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-1.5">
                    Handled by
                  </p>
                  <p className="text-body-sm text-foreground">{handledBy}</p>
                </div>
              </div>

              <form
                className="rounded-lg border border-border bg-surface p-4 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void onUpdateFollowUp(enquiry.id, {
                    lead_status: leadStatus,
                    call_notes: callNotes,
                  })
                }}
              >
                <div>
                  <label
                    htmlFor="lead-status"
                    className="block text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-2"
                  >
                    Follow-up status
                  </label>
                  <select
                    id="lead-status"
                    value={leadStatus}
                    onChange={(event) => setLeadStatus(event.target.value as LeadStatus)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-body-sm text-foreground outline-none focus:border-border-hover"
                  >
                    {LEAD_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="call-notes"
                    className="block text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-2"
                  >
                    Notes
                  </label>
                  <textarea
                    id="call-notes"
                    value={callNotes}
                    onChange={(event) => setCallNotes(event.target.value)}
                    rows={5}
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-body-sm text-foreground outline-none focus:border-border-hover"
                  />
                </div>

                <button
                  type="submit"
                  disabled={followUpSaving || !hasFollowUpChanges}
                  className="h-9 w-full rounded-lg bg-foreground px-4 text-label-lg font-semibold uppercase tracking-label text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {followUpSaving ? 'Saving...' : 'Save follow-up'}
                </button>
              </form>
            </div>

            <div className="px-7 py-5 border-t border-border shrink-0 flex items-center gap-3 flex-wrap">
              <a
                href={`mailto:${enquiry.email}`}
                onClick={() => { if (isUnread && canMarkRead) onMarkRead(enquiry.id) }}
                className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-foreground text-background text-label-lg font-semibold uppercase tracking-label hover:opacity-90 transition-opacity"
              >
                <Mail size={11} strokeWidth={2} />
                Reply via email
              </a>
              {canMarkRead && isUnread && (
                <button
                  onClick={() => onMarkRead(enquiry.id)}
                  disabled={marking === enquiry.id}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border text-label-lg font-semibold uppercase tracking-label text-foreground-muted hover:text-foreground hover:border-border-hover transition-all disabled:opacity-40"
                >
                  <Check size={11} strokeWidth={2.5} />
                  Mark read
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CheckIcon as Check,
  ExternalLinkIcon as ExternalLink,
  MailIcon as Mail,
  PhoneCallIcon as PhoneCall,
  PhoneIcon as Phone,
  XIcon as X,
} from '@/components/icons'
import { cn } from '@/lib/utils/cn'
import { TypePill } from './enquiry-badges'
import { formatDate, timeAgo } from './enquiry-format'
import type { Enquiry, LeadProgressUpdateInput, LeadStatus } from '@/services/enquiry'

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
  onUpdateLeadProgress: (id: string, input: LeadProgressUpdateInput) => Promise<void>
  followUpSaving: boolean
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function labelFromId(id: string) {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getSourceDetail(enquiry: Enquiry) {
  const sourceLabel = enquiry.source.label.toLowerCase()
  const parts = [
    enquiry.source.sectionId ? labelFromId(enquiry.source.sectionId) : null,
    enquiry.source.gateId ? labelFromId(enquiry.source.gateId) : null,
  ].filter((part): part is string => Boolean(part))
    .filter((part) => part.toLowerCase() !== sourceLabel)

  return parts.length ? parts.join(' · ') : null
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

function syncTextareaHeight(textarea: HTMLTextAreaElement) {
  const maxHeight = Math.min(window.innerHeight * 0.36, 320)

  textarea.style.height = 'auto'
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

function Section({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-label-lg text-foreground-muted/75">
        {label}
      </p>
      {children}
    </section>
  )
}

export function EnquiryPanel({
  enquiry,
  onClose,
  onUpdateLeadProgress,
  followUpSaving,
}: EnquiryPanelProps) {
  const [leadStatus, setLeadStatus] = useState<LeadStatus>('new')
  const [callNotes, setCallNotes] = useState('')
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const isOpen = !!enquiry
  const projectName = enquiry
    ? (enquiry.deployments?.project_name ?? enquiry.deployment_slug)
    : ''
  const handledBy = enquiry?.attended_by
    ? HANDLED_BY_LABELS[enquiry.attended_by]
    : 'Not handled yet'
  const customerMessage = enquiry?.message?.trim() ?? ''
  const sourceDetail = enquiry ? getSourceDetail(enquiry) : null
  const showVoiceSummary = enquiry
    ? !['pending', 'skipped'].includes(enquiry.call_status)
    : false
  const hasLeadProgressChanges = useMemo(() => {
    if (!enquiry) return false
    return leadStatus !== enquiry.lead_status || callNotes !== (enquiry.call_notes ?? '')
  }, [callNotes, enquiry, leadStatus])

  useEffect(() => {
    if (!enquiry) return
    setLeadStatus(enquiry.lead_status)
    setCallNotes(enquiry.call_notes ?? '')
  }, [enquiry])

  useEffect(() => {
    if (!notesRef.current) return
    syncTextareaHeight(notesRef.current)
  }, [callNotes, enquiry?.id])

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[34]',
          isOpen ? 'pointer-events-auto' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      <aside className={cn(
        'fixed top-0 right-0 z-[35] h-full w-full max-w-[480px] bg-background border-l border-border/80 flex flex-col transition-transform duration-300 ease-spring',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}>
        {enquiry && (
          <>
            <header className="shrink-0 border-b border-border px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-label-lg text-foreground-muted mb-2">
                    {formatDate(enquiry.created_at)} · {timeAgo(enquiry.created_at)}
                  </p>
                  <h2 className="font-primary text-[28px] leading-tight text-foreground truncate">
                    {enquiry.name}
                  </h2>
                  <p className="mt-1 text-body-sm text-foreground-muted truncate">
                    {projectName}
                  </p>
                </div>

                <button
                  onClick={onClose}
                  aria-label="Close enquiry details"
                  className="h-10 w-10 rounded-lg border border-border bg-surface/40 text-foreground-muted hover:text-foreground hover:bg-surface-hover hover:border-border-hover transition-colors flex items-center justify-center shrink-0"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
              <Section label="Lead summary">
                <div className="divide-y divide-border/70 rounded-lg border border-border bg-surface/30 text-body-sm">
                  {enquiry.phone && (
                    <div className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-3 px-4 py-3">
                      <span className="text-foreground-muted">Phone</span>
                      <a
                        href={`tel:${enquiry.phone}`}
                        className="inline-flex min-w-0 items-center gap-2 text-foreground transition-colors hover:text-foreground/75"
                      >
                        <Phone size={13} strokeWidth={1.8} className="shrink-0 text-foreground-muted" />
                        <span className="truncate">{enquiry.phone}</span>
                      </a>
                    </div>
                  )}
                  {enquiry.email && (
                    <div className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-3 px-4 py-3">
                      <span className="text-foreground-muted">Email</span>
                      <a
                        href={`mailto:${enquiry.email}`}
                        className="inline-flex min-w-0 items-center gap-2 text-foreground transition-colors hover:text-foreground/75"
                      >
                        <Mail size={13} strokeWidth={1.8} className="shrink-0 text-foreground-muted" />
                        <span className="truncate">{enquiry.email}</span>
                      </a>
                    </div>
                  )}
                  <div className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-3 px-4 py-3">
                    <span className="text-foreground-muted">Source</span>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <TypePill source={enquiry.source} />
                      {sourceDetail && (
                        <span className="min-w-0 text-foreground/80">{sourceDetail}</span>
                      )}
                    </div>
                  </div>
                  {showVoiceSummary && (
                    <div className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-3 px-4 py-3">
                      <span className="text-foreground-muted">Call</span>
                      <span className="inline-flex min-w-0 items-center gap-2 text-foreground/85">
                        <PhoneCall size={13} strokeWidth={1.8} className="shrink-0 text-foreground-muted" />
                        <span className="truncate">{getCallStatusText(enquiry)}</span>
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-3 px-4 py-3">
                    <span className="text-foreground-muted">Owner</span>
                    <span className="text-foreground/85">{handledBy}</span>
                  </div>
                  {enquiry.source_url && (
                    <div className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-3 px-4 py-3">
                      <span className="text-foreground-muted">Page</span>
                      <a
                        href={enquiry.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-w-0 items-center gap-1.5 text-foreground-muted transition-colors hover:text-foreground"
                      >
                        Open submitted page
                        <ExternalLink size={10} strokeWidth={1.75} className="shrink-0" />
                      </a>
                    </div>
                  )}
                </div>
              </Section>

              {customerMessage && (
                <Section label="Customer message">
                  <div className="border-l-2 border-border pl-4">
                    <p className="font-primary text-[15px] text-foreground/75 leading-relaxed whitespace-pre-wrap italic">
                      {customerMessage}
                    </p>
                  </div>
                </Section>
              )}

              <form
                className="space-y-4 pt-1"
                onSubmit={(event) => {
                  event.preventDefault()
                  void onUpdateLeadProgress(enquiry.id, {
                    lead_status: leadStatus,
                    call_notes: callNotes,
                  })
                }}
              >
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-label-lg text-foreground-muted/75">
                      Follow-up
                    </p>
                    {!hasLeadProgressChanges && !followUpSaving && (
                      <span
                        aria-live="polite"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-label text-success"
                      >
                        <Check size={11} strokeWidth={2.3} />
                        Saved
                      </span>
                    )}
                  </div>

                  <div className="space-y-4 rounded-lg border border-border bg-surface/35 p-4">
                    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3">
                      <label
                        htmlFor="lead-status"
                        className="text-body-sm font-medium text-foreground-muted"
                      >
                        Status
                      </label>
                      <select
                        id="lead-status"
                        value={leadStatus}
                        onChange={(event) => setLeadStatus(event.target.value as LeadStatus)}
                        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-body-sm text-foreground outline-none transition-colors focus:border-border-hover"
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
                        className="mb-2 block text-body-sm font-medium text-foreground-muted"
                      >
                        Notes
                      </label>
                      <textarea
                        ref={notesRef}
                        id="call-notes"
                        value={callNotes}
                        onChange={(event) => {
                          setCallNotes(event.target.value)
                          syncTextareaHeight(event.target)
                        }}
                        placeholder="Next step, call outcome, or context for the team."
                        rows={5}
                        className="max-h-[min(36vh,320px)] min-h-[132px] w-full resize-none rounded-lg border border-border bg-background px-3 py-3 text-body-sm text-foreground outline-none transition-colors focus:border-border-hover placeholder:text-foreground-muted/55"
                      />
                    </div>

                    {(hasLeadProgressChanges || followUpSaving) && (
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={followUpSaving}
                          className="h-9 rounded-lg bg-foreground px-4 text-label font-semibold uppercase tracking-label text-background transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                        >
                          {followUpSaving ? 'Saving...' : 'Save progress'}
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </form>

            </div>
          </>
        )}
      </aside>
    </>
  )
}

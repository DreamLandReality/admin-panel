'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Conversation } from '@11labs/client'
import {
  Mail, MailOpen, Phone, Search, ChevronDown, ChevronUp,
  ChevronsUpDown, ExternalLink, Check, CheckCheck, X,
  ArrowRight, ChevronLeft, ChevronRight, Inbox, Tag,
  PhoneCall, PhoneOff, RotateCw, XCircle, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Skeleton } from '@/components/ui'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useHeaderStore } from '@/stores/header-store'

// ─── Types ────────────────────────────────────────────────────────────────────

type CallStatus = 'pending' | 'scheduled' | 'calling' | 'completed' | 'no_answer' | 'failed' | 'cancelled' | 'skipped'

type Enquiry = {
  id: string
  deployment_id: string
  deployment_slug: string
  name: string
  email: string
  phone: string | null
  message: string | null
  source_url: string
  form_type: string
  is_read: boolean
  created_at: string
  deployments: { project_name: string } | null
  call_status: CallStatus
  call_scheduled_for: string | null
  call_completed_at: string | null
  call_transcript: string | null
  call_collected_data: Record<string, string> | null
  call_duration_seconds: number | null
  call_attempts: number
  call_signed_url: string | null
  call_property_context: string | null
}

type StatusFilter = 'all' | 'unread' | 'price-unlock' | 'contact'
type SortCol = 'name' | 'date' | 'property'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 10

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase()
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accent,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ReactNode
  accent?: 'amber' | 'info' | 'success' | 'default'
}) {
  const iconColors = {
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
    info: 'bg-info/10 border-info/20 text-info',
    success: 'bg-success/10 border-success/20 text-success',
    default: 'bg-foreground/[0.05] border-border text-foreground-muted',
  }
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-4 flex-1">
      <div>
        <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-2">
          {label}
        </p>
        <p className={cn(
          'font-serif text-[28px] font-light tabular-nums leading-none',
          accent === 'amber' && Number(value) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
        )}>
          {value}
        </p>
        {sub && (
          <p className="text-micro uppercase tracking-label text-foreground-muted/60 mt-1.5">{sub}</p>
        )}
      </div>
      <div className={cn(
        'w-10 h-10 rounded-full border flex items-center justify-center shrink-0',
        iconColors[accent ?? 'default']
      )}>
        {icon}
      </div>
    </div>
  )
}

function FilterBtn({
  label, active, open, onToggle, children,
}: {
  label: string; active: boolean; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-2 h-9 px-4 rounded-xl border text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap',
          active
            ? 'border-foreground/25 bg-foreground/[0.06] text-foreground'
            : 'border-border text-foreground-muted hover:text-foreground hover:border-border-hover'
        )}
      >
        {label}
        <ChevronDown size={9} strokeWidth={2.5} className={cn('transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-dropdown min-w-[180px] rounded-lg border border-border bg-surface shadow-float overflow-hidden animate-fade-in">
          {children}
        </div>
      )}
    </div>
  )
}

function DropItem({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-2.5 text-body-sm flex items-center justify-between gap-3 transition-colors',
        selected ? 'bg-surface-active text-foreground font-medium' : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
      )}
    >
      {children}
      {selected && <Check size={10} strokeWidth={2.5} className="shrink-0" />}
    </button>
  )
}

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={10} strokeWidth={2} className="text-foreground-muted/40" />
  return dir === 'asc'
    ? <ChevronUp size={10} strokeWidth={2.5} className="text-foreground" />
    : <ChevronDown size={10} strokeWidth={2.5} className="text-foreground" />
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ isRead, isPriceUnlock }: { isRead: boolean; isPriceUnlock: boolean }) {
  if (!isRead && isPriceUnlock) {
    return (
      <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[9px] font-bold uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 whitespace-nowrap">
        <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
        Price Unlock
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

function TypePill({ isPriceUnlock }: { isPriceUnlock: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center h-[16px] px-1.5 rounded-sm text-[9px] font-bold uppercase tracking-widest border leading-none',
      isPriceUnlock
        ? 'bg-amber-500/[0.07] border-amber-500/15 text-amber-600 dark:text-amber-400'
        : 'bg-foreground/[0.04] border-border/60 text-foreground-muted/70'
    )}>
      {isPriceUnlock ? 'Price Unlock' : 'Contact'}
    </span>
  )
}

// ─── Call Status Badge ────────────────────────────────────────────────────

const CALL_STATUS_CONFIG: Record<CallStatus, { label: string; color: string } | null> = {
  pending: null,
  skipped: null,
  scheduled: { label: 'Call Scheduled', color: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' },
  calling:   { label: 'Calling...', color: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' },
  completed: { label: 'Call Done', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
  no_answer: { label: 'No Answer', color: 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400' },
  failed:    { label: 'Call Failed', color: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' },
  cancelled: { label: 'Cancelled', color: 'bg-foreground/[0.04] border-border/60 text-foreground-muted/60' },
}

function CallStatusBadge({ status }: { status: CallStatus }) {
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

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const COLLECTED_DATA_LABELS: Record<string, string> = {
  property_interest: 'Interest',
  budget_range: 'Budget',
  preferred_area: 'Area',
  timeline: 'Timeline',
  callback_time: 'Callback',
  additional_notes: 'Notes',
  call_outcome: 'Outcome',
}

// ─── Side Panel ───────────────────────────────────────────────────────────────

function EnquiryPanel({
  enquiry,
  onClose,
  onMarkRead,
  marking,
  onCallAction,
  callActionLoading,
  onReload,
}: {
  enquiry: Enquiry | null
  onClose: () => void
  onMarkRead: (id: string) => void
  marking: string | null
  onCallAction: (id: string, action: 'retry' | 'cancel') => void
  callActionLoading: string | null
  onReload: () => void
}) {
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [callLive, setCallLive] = useState(false)
  const conversationRef = useRef<Conversation | null>(null)

  useEffect(() => {
    if (!enquiry?.call_signed_url || enquiry.call_status !== 'calling') return

    let cancelled = false
    ;(async () => {
      try {
        const propertyName = enquiry.deployments?.project_name ?? enquiry.deployment_slug
        const ctx = enquiry.call_property_context ?? ''
        const conversation = await Conversation.startSession({
          signedUrl: enquiry.call_signed_url as string,
          dynamicVariables: {
            caller_name: enquiry.name,
            property_name: propertyName,
          },
          overrides: ctx ? {
            agent: {
              prompt: {
                prompt: `The caller's name is ${enquiry.name}. They enquired about "${propertyName}".\n\nProperty details:\n${ctx}\n\nGreet them by name and reference this property. Only mention details that are explicitly listed in the property details above — do not assume or invent any information not provided.`
              }
            }
          } : undefined,
          onConnect: () => { if (!cancelled) setCallLive(true) },
          onDisconnect: () => {
            if (cancelled) return
            setCallLive(false)
            fetch(`/api/voice-call/${enquiry.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'complete_dev_call' }),
            })
            setTimeout(onReload, 2000)
          },
        })
        if (cancelled) {
          conversation.endSession()
          return
        }
        conversationRef.current = conversation
      } catch {
        // Dev mode — silent failure acceptable
      }
    })()

    return () => {
      cancelled = true
      conversationRef.current?.endSession()
      conversationRef.current = null
    }
  }, [enquiry?.id, enquiry?.call_signed_url, enquiry?.call_status, enquiry?.call_property_context, onReload])
  const isOpen = !!enquiry
  const isPriceUnlock = enquiry?.form_type === 'price-unlock'
  const isUnread = enquiry ? !enquiry.is_read : false
  const projectName = enquiry
    ? (enquiry.deployments?.project_name ?? enquiry.deployment_slug)
    : ''

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[34] transition-opacity duration-300',
          isOpen ? 'pointer-events-auto' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={cn(
        'fixed top-0 right-0 h-full w-[440px] bg-background border-l border-border shadow-modal z-[35] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}>
        {enquiry && (
          <>
            {/* Panel header */}
            <div className={cn(
              'flex items-start justify-between px-7 pt-7 pb-6 border-b border-border shrink-0',
              isPriceUnlock && isUnread && 'border-amber-500/10'
            )}>
              {/* Left accent bar in panel */}
              <div className={cn(
                'absolute left-0 top-8 h-12 w-[3px] rounded-r-full',
                isUnread ? isPriceUnlock ? 'bg-amber-500' : 'bg-foreground/30' : 'bg-transparent'
              )} />

              <div className="min-w-0 pr-4">
                <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-2">
                  {formatDate(enquiry.created_at)} · {timeAgo(enquiry.created_at)}
                </p>
                <h2 className="font-serif text-[24px] leading-tight text-foreground mb-2">
                  {enquiry.name}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge isRead={enquiry.is_read} isPriceUnlock={!!isPriceUnlock} />
                  <TypePill isPriceUnlock={!!isPriceUnlock} />
                </div>
              </div>

              <button
                onClick={onClose}
                className="h-7 w-7 rounded-lg border border-border flex items-center justify-center text-foreground-muted hover:text-foreground hover:border-border-hover transition-colors shrink-0 mt-0.5"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">

              {/* Contact */}
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

              {/* Property */}
              <div>
                <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-3">
                  Property
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm text-foreground font-medium">{projectName}</span>
                  <TypePill isPriceUnlock={!!isPriceUnlock} />
                </div>
              </div>

              {/* Message */}
              {enquiry.message ? (
                <div>
                  <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-3">
                    Message
                  </p>
                  <blockquote className={cn(
                    'border-l-2 pl-4 py-1',
                    isPriceUnlock ? 'border-amber-500/30' : 'border-border'
                  )}>
                    <p className="font-serif text-[14px] italic text-foreground/65 leading-relaxed whitespace-pre-wrap">
                      &ldquo;{enquiry.message}&rdquo;
                    </p>
                  </blockquote>
                </div>
              ) : (
                <div>
                  <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-3">
                    Message
                  </p>
                  <p className="text-body-sm text-foreground-muted italic">No message provided.</p>
                </div>
              )}

              {/* Source */}
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

              {/* Voice Call Section */}
              {enquiry.call_status && enquiry.call_status !== 'pending' && enquiry.call_status !== 'skipped' && (
                <div>
                  <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted mb-3">
                    Voice Call
                  </p>
                  <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
                    {/* Live call indicator (dev mode) */}
                    {callLive && (
                      <div className="flex items-center gap-2.5">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                        </span>
                        <span className="text-body-sm font-medium text-foreground">Live — speak now</span>
                      </div>
                    )}
                    {/* Status + duration */}
                    <div className="flex items-center justify-between">
                      {!callLive && <CallStatusBadge status={enquiry.call_status} />}
                      {enquiry.call_duration_seconds != null && enquiry.call_duration_seconds > 0 && (
                        <span className="text-micro tabular-nums text-foreground-muted">
                          {formatDuration(enquiry.call_duration_seconds)}
                        </span>
                      )}
                    </div>

                    {/* Scheduled time */}
                    {enquiry.call_status === 'scheduled' && enquiry.call_scheduled_for && (
                      <p className="flex items-center gap-1.5 text-body-sm text-foreground-muted">
                        <Clock size={10} strokeWidth={2} className="shrink-0" />
                        Scheduled for {new Date(enquiry.call_scheduled_for).toLocaleTimeString('en-US', {
                          hour: 'numeric', minute: '2-digit', hour12: true,
                        })}
                      </p>
                    )}

                    {/* Collected data */}
                    {enquiry.call_status === 'completed' && enquiry.call_collected_data &&
                      Object.keys(enquiry.call_collected_data).length > 0 && (
                      <div className="space-y-2 pt-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-foreground-muted/55">
                          Collected Info
                        </p>
                        <div className="space-y-1.5">
                          {Object.entries(enquiry.call_collected_data).map(([key, value]) => (
                            value && (
                              <div key={key} className="flex items-start gap-2 text-body-sm">
                                <span className="text-foreground-muted/60 shrink-0 min-w-[60px]">
                                  {COLLECTED_DATA_LABELS[key] || key}:
                                </span>
                                <span className="text-foreground">{value}</span>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transcript toggle */}
                    {enquiry.call_transcript && (
                      <div className="pt-1">
                        <button
                          onClick={() => setTranscriptOpen((v) => !v)}
                          className="flex items-center gap-1.5 text-body-sm text-foreground-muted hover:text-foreground transition-colors"
                        >
                          <ChevronDown
                            size={10}
                            strokeWidth={2.5}
                            className={cn('transition-transform duration-150', transcriptOpen && 'rotate-180')}
                          />
                          {transcriptOpen ? 'Hide' : 'View'} Transcript
                        </button>
                        {transcriptOpen && (
                          <pre className="mt-2 p-3 rounded-md bg-foreground/[0.03] border border-border text-[11px] leading-relaxed text-foreground/70 whitespace-pre-wrap max-h-[300px] overflow-y-auto font-sans">
                            {enquiry.call_transcript}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Panel footer — actions */}
            <div className="px-7 py-5 border-t border-border shrink-0 flex items-center gap-3 flex-wrap">
              <a
                href={`mailto:${enquiry.email}`}
                onClick={() => { if (isUnread) onMarkRead(enquiry.id) }}
                className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-foreground text-background text-label-lg font-semibold uppercase tracking-label hover:opacity-90 transition-opacity"
              >
                <Mail size={11} strokeWidth={2} />
                Reply via email
              </a>
              {isUnread && (
                <button
                  onClick={() => onMarkRead(enquiry.id)}
                  disabled={marking === enquiry.id}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border text-label-lg font-semibold uppercase tracking-label text-foreground-muted hover:text-foreground hover:border-border-hover transition-all disabled:opacity-40"
                >
                  <Check size={11} strokeWidth={2.5} />
                  Mark read
                </button>
              )}
              {/* Call retry */}
              {['failed', 'no_answer', 'cancelled'].includes(enquiry.call_status) && enquiry.phone && (
                <button
                  onClick={() => onCallAction(enquiry.id, 'retry')}
                  disabled={callActionLoading === enquiry.id}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border text-label-lg font-semibold uppercase tracking-label text-foreground-muted hover:text-foreground hover:border-border-hover transition-all disabled:opacity-40"
                >
                  <RotateCw size={10} strokeWidth={2.5} />
                  Retry Call
                </button>
              )}
              {/* Call cancel */}
              {enquiry.call_status === 'scheduled' && (
                <button
                  onClick={() => onCallAction(enquiry.id, 'cancel')}
                  disabled={callActionLoading === enquiry.id}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-red-500/20 text-label-lg font-semibold uppercase tracking-label text-red-500/70 hover:text-red-500 hover:border-red-500/40 transition-all disabled:opacity-40"
                >
                  <XCircle size={10} strokeWidth={2.5} />
                  Cancel Call
                </button>
              )}
              {/* End call (dev mode live session) */}
              {callLive && (
                <button
                  onClick={() => conversationRef.current?.endSession()}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-red-500/30 text-label-lg font-semibold uppercase tracking-label text-red-500 hover:bg-red-500/5 hover:border-red-500/50 transition-all"
                >
                  <PhoneOff size={10} strokeWidth={2.5} />
                  End Call
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between pt-4 border-t border-border mt-0">
      <p className="text-micro font-medium uppercase tracking-label text-foreground-muted/60 tabular-nums">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-foreground-muted hover:text-foreground hover:border-border-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft size={12} strokeWidth={2} />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="h-7 w-7 flex items-center justify-center text-micro text-foreground-muted/40">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={cn(
                'h-7 min-w-[28px] px-1 rounded-md text-label font-semibold uppercase tracking-label transition-colors',
                p === page
                  ? 'bg-foreground text-background'
                  : 'border border-border text-foreground-muted hover:text-foreground hover:border-border-hover'
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="h-7 w-7 rounded-md border border-border flex items-center justify-center text-foreground-muted hover:text-foreground hover:border-border-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight size={12} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

// ─── Table header cell ────────────────────────────────────────────────────────

function TH({
  children, sortable, col, active, dir, onSort, className,
}: {
  children: React.ReactNode
  sortable?: boolean
  col?: SortCol
  active?: boolean
  dir?: SortDir
  onSort?: (col: SortCol) => void
  className?: string
}) {
  const inner = (
    <span className="flex items-center gap-1.5">
      {children}
      {sortable && col && <SortIcon col={col} active={!!active} dir={dir ?? 'desc'} />}
    </span>
  )
  if (sortable && col && onSort) {
    return (
      <button
        onClick={() => onSort(col)}
        className={cn(
          'text-left text-[9px] font-bold uppercase tracking-widest text-foreground-muted/55 hover:text-foreground-muted transition-colors',
          className
        )}
      >
        {inner}
      </button>
    )
  }
  return (
    <div className={cn('text-[9px] font-bold uppercase tracking-widest text-foreground-muted/55', className)}>
      {inner}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EnquiryPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [sortCol, setSortCol] = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [propOpen, setPropOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [callActionLoading, setCallActionLoading] = useState<string | null>(null)

  const { setStats, clearStats } = useHeaderStore()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/enquiries')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load')
      setEnquiries(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!loading && !error) {
      const unread = enquiries.filter((e) => !e.is_read).length
      setStats([
        { label: 'Total', value: enquiries.length },
        { label: 'Unread', value: unread, colorClass: unread > 0 ? 'text-accent' : undefined },
      ])
    }
    return () => clearStats()
  }, [enquiries, loading, error, setStats, clearStats])

  const markRead = useCallback(async (id: string) => {
    if (markingId === id) return
    setMarkingId(id)
    try {
      await fetch('/api/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setEnquiries((prev) => prev.map((e) => e.id === id ? { ...e, is_read: true } : e))
    } finally {
      setMarkingId(null)
    }
  }, [markingId])

  const markAllRead = useCallback(async () => {
    const ids = enquiries.filter((e) => !e.is_read).map((e) => e.id)
    if (!ids.length) return
    await Promise.all(ids.map((id) =>
      fetch('/api/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    ))
    setEnquiries((prev) => prev.map((e) => ({ ...e, is_read: true })))
  }, [enquiries])

  const handleCallAction = useCallback(async (id: string, action: 'retry' | 'cancel') => {
    setCallActionLoading(id)
    try {
      const res = await fetch(`/api/voice-call/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const result = await res.json()
        const newStatus = result.status === 'cancelled' ? 'cancelled' : 'scheduled'
        setEnquiries((prev) =>
          prev.map((e) => e.id === id ? { ...e, call_status: newStatus as CallStatus } : e)
        )
      }
    } finally {
      setCallActionLoading(null)
    }
  }, [])

  useEffect(() => {
    if (!propOpen && !statusOpen) return
    const close = () => { setPropOpen(false); setStatusOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [propOpen, statusOpen])

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
    setPage(1)
  }

  const projects = Array.from(
    new Map(enquiries.map((e) => [
      e.deployment_slug,
      { slug: e.deployment_slug, name: e.deployments?.project_name ?? e.deployment_slug },
    ])).values()
  )

  const statusFilterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: 'New / Unread' },
    { value: 'price-unlock', label: 'Price Unlock' },
    { value: 'contact', label: 'Contact' },
  ]

  const unreadCount = enquiries.filter((e) => !e.is_read).length
  const priceUnlockCount = enquiries.filter((e) => e.form_type === 'price-unlock').length

  const filtered = enquiries
    .filter((e) => {
      if (statusFilter === 'unread') return !e.is_read
      if (statusFilter === 'price-unlock') return e.form_type === 'price-unlock'
      if (statusFilter === 'contact') return e.form_type !== 'price-unlock'
      return true
    })
    .filter((e) => propertyFilter === 'all' || e.deployment_slug === propertyFilter)
    .filter((e) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const proj = (e.deployments?.project_name ?? e.deployment_slug).toLowerCase()
      return (
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        proj.includes(q) ||
        (e.message ?? '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortCol === 'property') {
        const pa = a.deployments?.project_name ?? a.deployment_slug
        const pb = b.deployments?.project_name ?? b.deployment_slug
        cmp = pa.localeCompare(pb)
      } else {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedEnquiry = enquiries.find((e) => e.id === selectedId) ?? null

  const resetPage = () => setPage(1)

  // ── Grid template ──────────────────────────────────────────────────────────
  // dot | client | contact | property | date | status | action
  const GRID = 'grid-cols-[6px_minmax(0,2.5fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_130px_110px_40px]'

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col animate-fade-in gap-6">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 flex-1 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <div className={cn('grid gap-4 px-4 py-2 bg-surface-hover/50 border-b border-border', GRID)}>
            {['', ...['w-16', 'w-14', 'w-16', 'w-12', 'w-14', '']].map((w, i) => (
              <Skeleton key={i} className={cn('h-2.5 rounded', w)} />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn('grid gap-4 px-4 py-4 border-b border-border last:border-0 items-center', GRID)}>
              <div />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-2.5 w-48 rounded" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-36 rounded" />
                <Skeleton className="h-2.5 w-20 rounded" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-28 rounded" />
                <Skeleton className="h-3.5 w-16 rounded-sm" />
              </div>
              <Skeleton className="h-2.5 w-20 rounded" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <div />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState heading="Failed to load enquiries" description={error} onRetry={load} className="h-64" />
  }

  if (enquiries.length === 0) {
    return (
      <EmptyState
        heading="No enquiries yet"
        description="When visitors submit the contact or price unlock form on your deployed sites, their messages will appear here."
      />
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className={cn(
        'flex flex-col animate-fade-in gap-6 transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        selectedId && 'pr-[460px]'
      )}>

        {/* ── Filter bar ── */}
        <div className="flex items-center gap-2.5">
          {/* Search */}
          <label className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border bg-transparent cursor-text flex-1 focus-within:border-border-hover transition-colors">
            <Search size={11} strokeWidth={2} className="text-foreground-muted/50 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage() }}
              placeholder="Search clients or properties..."
              className="text-body-sm bg-transparent outline-none placeholder:text-foreground-muted/35 w-full text-foreground"
            />
          </label>

          {/* Status filter */}
          <FilterBtn
            label={statusFilterOptions.find((o) => o.value === statusFilter)?.label ?? 'All Status'}
            active={statusFilter !== 'all'}
            open={statusOpen}
            onToggle={() => { setStatusOpen((v) => !v); setPropOpen(false) }}
          >
            {statusFilterOptions.map((o) => (
              <DropItem
                key={o.value}
                selected={statusFilter === o.value}
                onClick={() => { setStatusFilter(o.value); setStatusOpen(false); resetPage() }}
              >
                <span className="flex items-center gap-2">
                  {o.value === 'unread' && unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                  {o.label}
                </span>
              </DropItem>
            ))}
          </FilterBtn>

          {/* Property filter */}
          <FilterBtn
            label={propertyFilter === 'all' ? 'All Properties' : (projects.find((p) => p.slug === propertyFilter)?.name ?? propertyFilter)}
            active={propertyFilter !== 'all'}
            open={propOpen}
            onToggle={() => { setPropOpen((v) => !v); setStatusOpen(false) }}
          >
            {[{ slug: 'all', name: 'All properties' }, ...projects].map((p) => (
              <DropItem
                key={p.slug}
                selected={propertyFilter === p.slug}
                onClick={() => { setPropertyFilter(p.slug); setPropOpen(false); resetPage() }}
              >
                {p.name}
              </DropItem>
            ))}
          </FilterBtn>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <>
              <span className="w-px h-4 bg-border shrink-0 mx-0.5" />
              <button
                onClick={markAllRead}
                className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border text-[9px] font-bold uppercase tracking-widest text-foreground-muted hover:text-foreground hover:border-border-hover transition-all whitespace-nowrap"
              >
                <CheckCheck size={10} strokeWidth={2} />
                Mark all read
              </button>
            </>
          )}

          {/* Result count */}
          {search || statusFilter !== 'all' || propertyFilter !== 'all' ? (
            <span className="ml-auto text-micro font-medium uppercase tracking-label text-foreground-muted/50 tabular-nums">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          ) : null}
        </div>

        {/* ── Table ── */}
        <div className="rounded-xl border border-border overflow-hidden">

          {/* Table header */}
          <div className={cn('grid gap-4 px-4 py-2 bg-surface-hover/40 border-b border-border items-center', GRID)}>
            <div />
            <TH sortable col="name" active={sortCol === 'name'} dir={sortDir} onSort={handleSort}>
              Client
            </TH>
            <TH>Contact</TH>
            <TH sortable col="property" active={sortCol === 'property'} dir={sortDir} onSort={handleSort}>
              Property
            </TH>
            <TH sortable col="date" active={sortCol === 'date'} dir={sortDir} onSort={handleSort}>
              Submitted
            </TH>
            <TH>Status</TH>
            <div />
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-micro font-semibold uppercase tracking-label-lg text-foreground-muted">
                No enquiries match your filter
              </p>
            </div>
          ) : (
            paginated.map((enquiry) => {
              const projectName = enquiry.deployments?.project_name ?? enquiry.deployment_slug
              const isPriceUnlock = enquiry.form_type === 'price-unlock'
              const isUnread = !enquiry.is_read
              const isSelected = selectedId === enquiry.id

              return (
                <div
                  key={enquiry.id}
                  className={cn(
                    'relative border-b border-border/50 last:border-0 transition-colors duration-150 cursor-pointer group',
                    isSelected
                      ? 'bg-surface-active'
                      : isUnread && isPriceUnlock
                        ? 'bg-amber-500/[0.015] hover:bg-amber-500/[0.03]'
                        : isUnread
                          ? 'bg-foreground/[0.008] hover:bg-surface-hover'
                          : 'hover:bg-surface-hover'
                  )}
                  onClick={() => setSelectedId(isSelected ? null : enquiry.id)}
                >
                  {/* Left state bar */}
                  <div className={cn(
                    'absolute left-0 inset-y-0 w-[3px] transition-all duration-200',
                    isSelected
                      ? 'bg-foreground/40'
                      : isUnread
                        ? isPriceUnlock ? 'bg-amber-500/70' : 'bg-foreground/20'
                        : 'bg-transparent'
                  )} />

                  <div className={cn('grid gap-4 px-4 py-4 items-center', GRID)}>

                    {/* Dot */}
                    <div className="flex justify-center">
                      {isUnread && (
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          isPriceUnlock
                            ? 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]'
                            : 'bg-foreground/30'
                        )} />
                      )}
                    </div>

                    {/* Client — name (serif) + message preview */}
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

                    {/* Contact */}
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

                    {/* Property */}
                    <div className="min-w-0 space-y-1.5">
                      <p className={cn(
                        'font-serif text-[15px] leading-tight tracking-tight truncate',
                        isPriceUnlock ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                      )}>
                        {projectName}
                      </p>
                      <TypePill isPriceUnlock={isPriceUnlock} />
                    </div>

                    {/* Date */}
                    <div>
                      <p className="text-micro uppercase tracking-label tabular-nums text-foreground-muted/70">
                        {formatDate(enquiry.created_at)}
                      </p>
                      <p className="text-micro tabular-nums text-foreground-muted/40 mt-0.5">
                        {timeAgo(enquiry.created_at)}
                      </p>
                    </div>

                    {/* Status badge */}
                    <div className="space-y-1">
                      <StatusBadge isRead={enquiry.is_read} isPriceUnlock={isPriceUnlock} />
                      <CallStatusBadge status={enquiry.call_status} />
                    </div>

                    {/* Action */}
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

        {/* ── Pagination ── */}
        <Pagination
          page={page}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
        />
      </div>

      {/* ── Side panel ── */}
      <EnquiryPanel
        enquiry={selectedEnquiry}
        onClose={() => setSelectedId(null)}
        onMarkRead={(id) => {
          markRead(id)
        }}
        marking={markingId}
        onCallAction={handleCallAction}
        callActionLoading={callActionLoading}
        onReload={load}
      />
    </>
  )
}

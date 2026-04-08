'use client'

import { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { usePageList } from '@/hooks/use-page-list'
import { TextInput, TextArea } from '@/components/forms'

// ─── PanelPagePicker ──────────────────────────────────────────────────────────

export function PanelPagePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const pages = usePageList()
  const options = pages.map((p) => ({ label: p.name, value: p.path }))
  const isCustom = !!value && !options.some((o) => o.value === value)

  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      <select
        value={isCustom ? '__custom__' : (value || '')}
        onChange={(e) => { if (e.target.value !== '__custom__') onChange(e.target.value) }}
        className="panel-input"
      >
        <option value="">— select page —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        {isCustom && <option value="__custom__">{value} (custom)</option>}
      </select>
      <TextInput
        variant="panel"
        type="text"
        value={value}
        placeholder="or type a custom URL"
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 text-xs py-1.5 placeholder:text-muted-foreground/40"
      />
    </div>
  )
}

// ─── PanelSelect ──────────────────────────────────────────────────────────────

export function PanelSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[] | { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  // Normalize options to array of objects
  const normalizedOptions = options.map(opt => 
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  )
  
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-md bg-surface border border-border-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
      >
        <option value="">— select —</option>
        {normalizedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

export function Breadcrumb({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      aria-label={`Back from ${label}`}
      className="flex items-center gap-1.5 px-4 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors w-full border-b border-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
        <path d="M7.5 9L4.5 6l3-3" />
      </svg>
      <span className="truncate font-mono">{label}</span>
    </button>
  )
}

// ─── PanelInput ───────────────────────────────────────────────────────────────

export function PanelInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      <TextInput
        variant="panel"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="placeholder:text-muted-foreground/40"
      />
    </div>
  )
}

// ─── PanelTextarea ────────────────────────────────────────────────────────────

export function PanelTextarea({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      <TextArea
        ref={ref}
        variant="panel"
        value={value}
        placeholder={placeholder}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        className="placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      />
    </div>
  )
}

// ─── PanelNumberInput ─────────────────────────────────────────────────────────

export function PanelNumberInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      <TextInput
        variant="panel"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

// ─── PanelSlider ──────────────────────────────────────────────────────────────

export function PanelSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
        <span className="text-xs text-foreground tabular-nums font-medium">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-surface-hover rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">{min}</span>
        <span className="text-[10px] text-muted-foreground">{max}</span>
      </div>
    </div>
  )
}

// ─── PanelColorInput ──────────────────────────────────────────────────────────

export function PanelColorInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <label className="relative w-8 h-8 rounded-md overflow-hidden border border-white/10 cursor-pointer flex-shrink-0">
          <div className="absolute inset-0" style={{ backgroundColor: value }} />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn('panel-input flex-1 font-mono')}
        />
      </div>
    </div>
  )
}

// ─── File type validation ─────────────────────────────────────────────────────
// Checks a file's MIME type against an accept string (e.g. "application/pdf,video/*").
// Supports exact matches ("application/pdf") and wildcards ("video/*", "image/*").

function matchesAccept(file: File, accept: string): boolean {
  return accept.split(',').map(s => s.trim()).some(token => {
    if (token.endsWith('/*')) return file.type.startsWith(token.slice(0, -1))
    return file.type === token
  })
}

// ─── FileUploadButton ─────────────────────────────────────────────────────────
// General-purpose upload for PDFs, videos, or any file type.
// Driven by uiAccept from the manifest schema (e.g. "application/pdf", "video/*").

export function FileUploadButton({
  accept,
  currentUrl,
  onSelect,
}: {
  accept?: string
  currentUrl?: string
  onSelect: (url: string, file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  // Track the real filename separately — blob URLs are meaningless UUIDs,
  // so we capture file.name on selection and keep it in state.
  const [pickedName, setPickedName] = useState<string | null>(null)
  const [typeError, setTypeError] = useState<string | null>(null)
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null)

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl)
      }
    }
  }, [currentBlobUrl])

  // For CDN / relative URLs (not blob:), extract the filename from the path.
  const urlName = currentUrl && !currentUrl.startsWith('blob:')
    ? decodeURIComponent(currentUrl.split('/').pop()?.split('?')[0] ?? '')
    : null

  // Precedence: name picked this session > name from CDN URL > nothing
  const filename = pickedName ?? urlName ?? null
  const hasFile = !!(currentUrl || filename)

  const isPdf = accept?.includes('pdf') || filename?.toLowerCase().endsWith('.pdf')
  const isVideo = accept?.startsWith('video') || !!filename?.toLowerCase().match(/\.(mp4|webm|mov)$/)

  return (
    <div>
      {hasFile && (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-surface-hover border border-border-subtle mb-2">
          {isPdf ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-red-400 shrink-0">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
          ) : isVideo ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-blue-400 shrink-0">
              <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted-foreground shrink-0">
              <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" /><polyline points="13 2 13 9 20 9" />
            </svg>
          )}
          <span className="text-xs text-muted-foreground truncate flex-1">
            {filename ?? 'Uploaded file'}
          </span>
          {/* Preview button — opens PDF/video in a new tab */}
          {currentUrl && (isPdf || isVideo) && (
            <button
              onClick={() => window.open(currentUrl, '_blank')}
              title="Preview"
              className="text-muted-foreground/50 hover:text-foreground transition-colors shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          )}
        </div>
      )}
      {typeError && (
        <p className="text-[10px] text-red-400 mb-1.5">{typeError}</p>
      )}
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M7 2v10M2 7l5-5 5 5" />
        </svg>
        {hasFile ? 'Replace File' : 'Upload File'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          e.target.value = ''
          if (accept && !matchesAccept(file, accept)) {
            setTypeError(`Invalid file type. Expected: ${accept}`)
            return
          }
          setTypeError(null)
          setPickedName(file.name)
          
          // Revoke old blob URL before creating new one
          if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl)
          }
          
          const blobUrl = URL.createObjectURL(file)
          setCurrentBlobUrl(blobUrl)
          onSelect(blobUrl, file)
        }}
      />
    </div>
  )
}

// ─── PanelToggle ──────────────────────────────────────────────────────────────
// Boolean on/off toggle for type: 'boolean' or widget === 'toggle' fields.

export function PanelToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <button
        onClick={() => onChange(!value)}
        aria-checked={value}
        role="switch"
        className={cn(
          'relative w-8 h-[18px] rounded-full transition-colors duration-200 flex-shrink-0',
          value ? 'bg-accent' : 'bg-white/10'
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform duration-200',
            value ? 'translate-x-[14px]' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  )
}

// ─── ImageUploadButton ────────────────────────────────────────────────────────

export function ImageUploadButton({ onSelect }: { onSelect: (url: string, file?: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [typeError, setTypeError] = useState<string | null>(null)
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null)

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl)
      }
    }
  }, [currentBlobUrl])

  return (
    <>
      {typeError && (
        <p className="text-[10px] text-red-400 mb-1.5">{typeError}</p>
      )}
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M7 2v10M2 7l5-5 5 5" />
        </svg>
        Replace Image
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          e.target.value = ''
          if (!file.type.startsWith('image/')) {
            setTypeError('Only image files are allowed')
            return
          }
          setTypeError(null)
          
          // Revoke old blob URL before creating new one
          if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl)
          }
          
          const blobUrl = URL.createObjectURL(file)
          setCurrentBlobUrl(blobUrl)
          onSelect(blobUrl, file)
        }}
      />
    </>
  )
}

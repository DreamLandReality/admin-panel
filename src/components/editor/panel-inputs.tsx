'use client'

import { useRef } from 'react'
import { usePageList } from '@/hooks/use-page-list'

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

  const options = pages.map((p) => ({
    label: p.name,
    value: p.path,
  }))

  const isCustom = !!value && !options.some((o) => o.value === value)

  return (
    <div>
      <label className="block text-label uppercase tracking-label text-muted-foreground mb-1.5">{label}</label>
      <select
        value={isCustom ? '__custom__' : (value || '')}
        onChange={(e) => { if (e.target.value !== '__custom__') onChange(e.target.value) }}
        className="w-full bg-white/5 rounded-md px-2.5 py-2 text-sm text-foreground border border-transparent focus:border-white/20 focus:outline-none transition-colors"
      >
        <option value="">— select page —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        {isCustom && <option value="__custom__">{value} (custom)</option>}
      </select>
      <input
        type="text"
        value={value}
        placeholder="or type a custom URL"
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full bg-white/5 rounded-md px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 border border-transparent focus:border-white/20 focus:outline-none transition-colors"
      />
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
      <label className="block text-label uppercase tracking-label text-muted-foreground mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 rounded-md px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 border border-transparent focus:border-white/20 focus:outline-none transition-colors"
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
  return (
    <div>
      <label className="block text-label uppercase tracking-label text-muted-foreground mb-1.5">{label}</label>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 rounded-md px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 border border-transparent focus:border-white/20 focus:outline-none transition-colors resize-y min-h-[60px]"
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
      <label className="block text-label uppercase tracking-label text-muted-foreground mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-white/5 rounded-md px-2.5 py-2 text-sm text-foreground border border-transparent focus:border-white/20 focus:outline-none transition-colors"
      />
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
      <label className="block text-label uppercase tracking-label text-muted-foreground mb-1.5">{label}</label>
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
          className="flex-1 bg-white/5 rounded-md px-2.5 py-2 text-sm text-foreground font-mono border border-transparent focus:border-white/20 focus:outline-none transition-colors"
        />
      </div>
    </div>
  )
}

// ─── ImageUploadButton ────────────────────────────────────────────────────────

export function ImageUploadButton({ onSelect }: { onSelect: (url: string, file?: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <>
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
          const blobUrl = URL.createObjectURL(file)
          onSelect(blobUrl, file)
        }}
      />
    </>
  )
}

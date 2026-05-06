'use client'

import { ChevronLeftIcon } from '@/components/icons'

export function Breadcrumb({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      aria-label={`Back from ${label}`}
      className="flex items-center gap-1.5 px-4 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors w-full border-b border-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
    >
      <ChevronLeftIcon width={12} height={12} strokeWidth={1.4} />
      <span className="truncate font-mono">{label}</span>
    </button>
  )
}

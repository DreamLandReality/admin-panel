'use client'

import { AdminLockIcon } from '@/components/icons'

export function LockedFieldDisplay({ label, value }: { label: string; value: any }) {
  let display: string
  if (value == null || value === '') {
    display = '—'
  } else if (typeof value === 'object') {
    display = JSON.stringify(value)
  } else {
    display = String(value)
  }

  return (
    <div className="relative">
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">
        <span className="inline-flex items-center gap-1.5">
          <AdminLockIcon width={9} height={9} strokeWidth={2} className="text-muted-foreground/40" />
          {label}
        </span>
      </label>
      <div className="px-2.5 py-1.5 rounded-md bg-white/[0.02] border border-white/5 text-xs text-muted-foreground/50 truncate">
        {display}
      </div>
    </div>
  )
}

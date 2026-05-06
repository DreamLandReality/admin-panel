'use client'

export function NestedObjectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-1">
      <div className="px-2.5 py-2 rounded-md bg-white/[0.05]">
        <span className="text-xs font-medium text-foreground/80">{label}</span>
      </div>
      <div className="pl-2.5 mt-2 space-y-3 pb-1">
        {children}
      </div>
    </div>
  )
}

import { cn } from '@/lib/utils/cn'

export interface PanelHeaderProps {
  title: string
  subtitle?: string
  sticky?: boolean
  children?: React.ReactNode
  className?: string
}

export function PanelHeader({ title, subtitle, sticky = false, children, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'px-4 pt-4 pb-3 bg-editor-surface border-b border-white/5',
        sticky && 'sticky top-0 z-10',
        className,
      )}
    >
      <p className="text-label-lg uppercase tracking-label text-muted-foreground">{title}</p>
      {subtitle && (
        <p className="text-label text-muted-foreground/60 mt-1">{subtitle}</p>
      )}
      {children}
    </div>
  )
}

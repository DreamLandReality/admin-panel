'use client'

import { cn } from '@/lib/utils/cn'
import { Monitor, TabletSmartphone, Smartphone } from 'lucide-react'
import { useWizardStore } from '@/stores/wizard-store'

type Viewport = 'mobile' | 'tablet' | 'desktop'

const VIEWPORT_CONFIG = {
  mobile: { label: 'Mobile', icon: Smartphone },
  tablet: { label: 'Tablet', icon: TabletSmartphone },
  desktop: { label: 'Desktop', icon: Monitor },
} as const

interface ViewportSwitcherProps {
  /** Show text labels alongside icons */
  showLabels?: boolean
  /** Custom className for the container */
  className?: string
  /** Icon size */
  iconSize?: number
}

export function ViewportSwitcher({ 
  showLabels = false, 
  className,
  iconSize = 14
}: ViewportSwitcherProps) {
  const { viewport, setViewport } = useWizardStore((s) => ({ 
    viewport: s.viewport, 
    setViewport: s.setViewport 
  }))

  return (
    <div className={cn(
      'flex gap-0.5 rounded-md p-0.5',
      showLabels 
        ? 'bg-black/20 border border-white/5' 
        : 'bg-white/5 border border-border',
      className
    )}>
      {(['mobile', 'tablet', 'desktop'] as const).map((bp) => {
        const config = VIEWPORT_CONFIG[bp]
        const Icon = config.icon
        const isActive = viewport === bp
        
        return (
          <button
            key={bp}
            type="button"
            onClick={() => setViewport(bp)}
            title={config.label}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded transition-all cursor-pointer',
              showLabels ? 'flex-1 py-1.5 text-xs' : 'w-8 h-8',
              isActive
                ? 'bg-white/10 text-foreground shadow-sm'
                : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5'
            )}
          >
            <Icon size={iconSize} strokeWidth={1.5} className="pointer-events-none" />
            {showLabels && <span className="pointer-events-none">{config.label}</span>}
          </button>
        )
      })}
    </div>
  )
}

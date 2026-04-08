import { cn } from '@/lib/utils/cn'

const variantMap = {
  display:       'font-serif text-5xl font-bold tracking-tight text-foreground',
  h1:            'font-serif text-h1 font-semibold tracking-tight text-foreground',
  h2:            'font-serif text-h2 font-semibold text-foreground',
  h3:            'font-serif text-h3 font-semibold text-foreground',
  'page-title':  'font-serif text-page-title tracking-tight text-foreground',
  'modal-title': 'font-serif text-modal-title font-light text-foreground',
  section:       'font-serif text-2xl font-light text-foreground',
  logo:          'font-serif text-logo text-foreground dark:text-white leading-tight tracking-wide',
  stat:          'font-serif text-3xl font-light tabular-nums leading-none',
} as const

const defaultTag: Record<keyof typeof variantMap, 'h1' | 'h2' | 'h3' | 'p' | 'span'> = {
  display:       'h1',
  h1:            'h1',
  h2:            'h2',
  h3:            'h3',
  'page-title':  'h1',
  'modal-title': 'h2',
  section:       'h2',
  logo:          'span',
  stat:          'span',
}

export interface HeadingProps {
  variant?: keyof typeof variantMap
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span'
  children: React.ReactNode
  className?: string
}

export function Heading({ variant = 'h2', as, children, className }: HeadingProps) {
  const Tag = as ?? defaultTag[variant]
  return (
    <Tag className={cn(variantMap[variant], className)}>
      {children}
    </Tag>
  )
}

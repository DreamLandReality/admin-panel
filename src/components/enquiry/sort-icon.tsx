import {
  ChevronDownIcon as ChevronDown,
  ChevronsUpDownIcon as ChevronsUpDown,
  ChevronUpIcon as ChevronUp,
} from '@/components/icons'
import type { SortDir } from './enquiry-types'

export function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={10} strokeWidth={2} className="text-foreground-muted/40" />
  return dir === 'asc'
    ? <ChevronUp size={10} strokeWidth={2.5} className="text-foreground" />
    : <ChevronDown size={10} strokeWidth={2.5} className="text-foreground" />
}

import { isRecord } from '@/lib/api/contracts'

export const PARENT_TO_RUNTIME_MESSAGE_TYPES = [
  'full-update',
  'field-update',
  'section-toggle',
  'style-update',
  'viewport-change',
  'section-highlight',
  'scroll-to-section',
] as const

export const RUNTIME_TO_PARENT_MESSAGE_TYPES = [
  'ready',
  'component-selected',
  'element-selected',
  'field-edited',
  'image-replace-requested',
  'deselect',
  'navigate-request',
] as const

export type ParentToRuntimeMessageType = typeof PARENT_TO_RUNTIME_MESSAGE_TYPES[number]
export type RuntimeToParentMessageType = typeof RUNTIME_TO_PARENT_MESSAGE_TYPES[number]

export type ParentToRuntimeMessage =
  | { type: 'full-update'; data: Record<string, unknown>; sections?: unknown; editabilityMap?: unknown; isViewOnly?: boolean; viewport?: string }
  | { type: 'field-update'; sectionId: string; field: string; value: unknown }
  | { type: 'section-toggle'; sectionId: string; enabled: boolean }
  | { type: 'style-update'; sectionId: string; field: string; styles: unknown }
  | { type: 'viewport-change'; viewport: string }
  | { type: 'section-highlight'; sectionId: string }
  | { type: 'scroll-to-section'; sectionId: string }

export type RuntimeToParentMessage =
  | { type: 'ready'; [key: string]: unknown }
  | { type: 'component-selected'; sectionId: string; fieldPath: string; pageId?: string; fieldType?: string }
  | { type: 'element-selected'; sectionId: string; field: string; elementType?: string; content?: string; itemIndex?: number }
  | { type: 'field-edited'; sectionId: string; field: string; value: unknown; listName?: string; itemIndex?: number }
  | { type: 'image-replace-requested'; sectionId: string; field: string }
  | { type: 'deselect' }
  | { type: 'navigate-request'; pathname: string }

export function isParentToRuntimeMessage(message: unknown): message is ParentToRuntimeMessage {
  if (!isRecord(message) || typeof message.type !== 'string') return false

  switch (message.type) {
    case 'full-update':
      return isRecord(message.data)
    case 'field-update':
      return typeof message.sectionId === 'string' && typeof message.field === 'string'
    case 'section-toggle':
      return typeof message.sectionId === 'string' && typeof message.enabled === 'boolean'
    case 'style-update':
      return typeof message.sectionId === 'string' && typeof message.field === 'string'
    case 'viewport-change':
      return typeof message.viewport === 'string'
    case 'section-highlight':
    case 'scroll-to-section':
      return typeof message.sectionId === 'string'
    default:
      return false
  }
}

export function isRuntimeToParentMessage(message: unknown): message is RuntimeToParentMessage {
  if (!isRecord(message) || typeof message.type !== 'string') return false

  switch (message.type) {
    case 'ready':
    case 'deselect':
      return true
    case 'component-selected':
      return typeof message.sectionId === 'string' && typeof message.fieldPath === 'string'
    case 'element-selected':
    case 'field-edited':
    case 'image-replace-requested':
      return typeof message.sectionId === 'string' && typeof message.field === 'string'
    case 'navigate-request':
      return typeof message.pathname === 'string'
    default:
      return false
  }
}

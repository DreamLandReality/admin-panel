import type { StyleControl } from '@/types'

export interface SchemaFieldRendererProps {
  properties: Record<string, any>
  data: Record<string, any>
  onChange: (fieldPath: string, value: any) => void
  onImageUpload?: (fieldPath: string, url: string, file?: File) => void
  prefix?: string
  fields?: string[]
  collectionData?: Record<string, any[]>
  skipSystem?: boolean
  fieldStyleControls?: Record<string, StyleControl[]>
  sectionId?: string
  iframeRef?: React.RefObject<HTMLIFrameElement | null>
}

export interface RendererSharedProps {
  data: Record<string, any>
  onChange: (fieldPath: string, value: any) => void
  onImageUpload?: (fieldPath: string, url: string, file?: File) => void
  prefix: string
  collectionData: Record<string, any[]>
  skipSystem: boolean
  fieldStyleControls?: Record<string, StyleControl[]>
  sectionId?: string
  iframeRef?: React.RefObject<HTMLIFrameElement | null>
}

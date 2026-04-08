/**
 * iframe utilities — secure postMessage bridge between the editor and the preview iframe.
 *
 * Security model:
 * - We always target a specific origin (template.preview_url) instead of '*'.
 *   Using '*' would allow any cross-origin listener to receive editor payloads,
 *   which may contain unpublished site content.
 * - If the preview URL is missing or malformed, we fall back to window.location.origin
 *   (same-origin), which is safe — same-origin postMessage cannot be intercepted
 *   by third-party listeners.
 *
 * Consumers:
 * - EditorShell → postToIframe for live field update messages
 * - Message shape: { type: 'FIELD_UPDATE' | 'SECTION_TOGGLE' | ..., payload: {...} }
 */
import { useWizardStore } from '@/stores/wizard-store'

/** Derive the iframe origin for secure postMessage targeting */
export function getIframeOrigin(previewUrl: string): string {
  try { return new URL(previewUrl).origin } catch {
    // Falling back to window.location.origin is safe — same-origin postMessage
    // cannot be intercepted by cross-origin listeners. This indicates a
    // misconfigured preview_url on the template, not a security issue.
    console.warn('[iframe] Invalid preview URL — falling back to same origin:', previewUrl)
    return window.location.origin
  }
}

/** Get preview origin from the current wizard store state */
export function getPreviewOrigin(): string {
  const t = useWizardStore.getState().selectedTemplate
  const url = t?.preview_url ?? t?.config?.previewUrl ?? ''
  return getIframeOrigin(url)
}

/** Send a postMessage to the preview iframe */
export function postToIframe(iframeRef: React.RefObject<HTMLIFrameElement | null>, msg: any) {
  const origin = getPreviewOrigin()
  console.log('[iframe] postToIframe:', { msg, origin, hasContentWindow: !!iframeRef.current?.contentWindow })
  iframeRef.current?.contentWindow?.postMessage(msg, origin)
}

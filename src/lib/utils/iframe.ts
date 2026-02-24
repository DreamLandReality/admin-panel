import { useWizardStore } from '@/stores/wizard-store'

/** Derive the iframe origin for secure postMessage targeting */
export function getIframeOrigin(previewUrl: string): string {
  try { return new URL(previewUrl).origin } catch { return window.location.origin }
}

/** Get preview origin from the current wizard store state */
export function getPreviewOrigin(): string {
  const t = useWizardStore.getState().selectedTemplate
  const url = t?.preview_url ?? t?.config?.previewUrl ?? 'http://localhost:4321'
  return getIframeOrigin(url)
}

/** Send a postMessage to the preview iframe */
export function postToIframe(iframeRef: React.RefObject<HTMLIFrameElement | null>, msg: any) {
  iframeRef.current?.contentWindow?.postMessage(msg, getPreviewOrigin())
}

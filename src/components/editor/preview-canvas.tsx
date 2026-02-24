'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWizardStore } from '@/stores/wizard-store'
import { resolveAllSectionStyles } from '@/lib/utils/style-defaults'
import { buildPageList } from '@/lib/utils/page-list'
import { resolveReferences } from '@/lib/utils/collection-resolver'
import { getIframeOrigin } from '@/lib/utils/iframe'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import type { Collection } from '@/types'

const VIEWPORT_WIDTHS: Record<string, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 375,
}

/** Deep-walk data and replace blob URL strings with their data URL equivalents */
function deepReplaceBlobUrls(data: any, dataUrls: Record<string, string>): any {
  if (typeof data === 'string') return dataUrls[data] ?? data
  if (Array.isArray(data)) return data.map((item) => deepReplaceBlobUrls(item, dataUrls))
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, deepReplaceBlobUrls(v, dataUrls)])
    )
  }
  return data
}

interface PreviewCanvasProps {
  templatePreviewUrl: string
  iframeRef: React.RefObject<HTMLIFrameElement>
}

export function PreviewCanvas({ templatePreviewUrl, iframeRef }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [iframeReady, setIframeReady] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingImageRef = useRef<{ sectionId: string; field: string } | null>(null)
  const lastInlineEditTimestamp = useRef(0)
  const iframeLoadFallbackRef = useRef<ReturnType<typeof setTimeout>>()

  const { viewport, sectionData, collectionData, sectionsRegistry, selectedTemplate, updateField, setSelection, clearSelection, setBlobUrl, setDataUrl, dataUrls, activePage } =
    useWizardStore()

  // Fallback to localhost:4321 when preview URL is empty/invalid
  const effectivePreviewUrl = templatePreviewUrl || 'http://localhost:4321'

  // Derive base origin once from the preview URL
  const baseOrigin = useMemo(() => {
    try { return new URL(effectivePreviewUrl).origin } catch { return '' }
  }, [effectivePreviewUrl])

  // Returns items from the manifest build-time baseline (not live collectionData/sectionData).
  // Used to detect whether a slug belongs to a pre-built page or is a new item added after
  // deployment — new items must route to the /preview skeleton, not the real slug URL.
  function getOriginalManifestItems(manifest: any, dynamicPageDef: any): any[] {
    if (!dynamicPageDef) return []
    if (dynamicPageDef.sourceCollection) {
      const col = manifest?.collections?.find((c: any) => c.id === dynamicPageDef.sourceCollection)
      return col?.data ?? []
    }
    if (dynamicPageDef.sourceSection) {
      const section = manifest?.sections?.find((s: any) => s.id === dynamicPageDef.sourceSection)
      const rawData = section?.data
      const itemsPath = dynamicPageDef.itemsPath
      return Array.isArray(rawData)
        ? rawData
        : (itemsPath && rawData ? (rawData as any)[itemsPath] : null) ?? []
    }
    return []
  }

  function getPageUrl(pageId: string): string {
    if (!baseOrigin) return `${effectivePreviewUrl}?preview=true`
    const manifest = selectedTemplate?.manifest

    // Handle dynamic-parent pages: load the first child's detail page in the preview iframe.
    // If that first child is a new item (not in the original manifest baseline), route to the
    // /preview skeleton so the iframe gets a pre-built page that preview-runtime can hydrate.
    if (pageId.startsWith('__parent:')) {
      const pageList = buildPageList(manifest, sectionData, collectionData)
      const parentEntry = pageList.find((p) => p.id === pageId)
      if (parentEntry?.firstChildSlug) {
        const dynamicPageDef = manifest?.pages?.find(
          (p: any) => p.dynamic && p.id === parentEntry.dynamicPageId
        )
        if (dynamicPageDef) {
          const slugField = dynamicPageDef.slugField ?? 'slug'
          const basePath = dynamicPageDef.path.split('/:')[0]
          const originalItems = getOriginalManifestItems(manifest, dynamicPageDef)
          const isNewFirstChild = !originalItems.some(
            (item: any) => item[slugField] === parentEntry.firstChildSlug
          )
          if (isNewFirstChild) {
            return `${baseOrigin}${basePath}/preview?preview=true`
          }
          const resolvedPath = dynamicPageDef.path.replace(`:${slugField}`, parentEntry.firstChildSlug)
          return `${baseOrigin}${resolvedPath}?preview=true`
        }
      }
      return `${baseOrigin}/?preview=true`
    }

    // Check static pages in manifest
    const staticPage = manifest?.pages?.find((p: any) => !p.dynamic && p.id === pageId)
    if (staticPage) return `${baseOrigin}${staticPage.path}?preview=true`

    // Check dynamic pages — detect new items and route to /preview skeleton instead of
    // the real slug URL (which won't exist for items added after deployment).
    const dynamicPageDef = manifest?.pages?.find((p: any) => p.dynamic)
    if (dynamicPageDef) {
      const slugField = dynamicPageDef.slugField ?? 'slug'
      const basePath = dynamicPageDef.path.split('/:')[0]
      const originalItems = getOriginalManifestItems(manifest, dynamicPageDef)
      const isNewItem = !originalItems.some((item: any) => item[slugField] === pageId)
      if (isNewItem) {
        // New item has no pre-built HTML page — route to the static /preview skeleton.
        // preview-runtime.ts will hydrate it with the real item data via postMessage full-update.
        return `${baseOrigin}${basePath}/preview?preview=true`
      }
      const resolvedPath = dynamicPageDef.path.replace(`:${slugField}`, pageId)
      return `${baseOrigin}${resolvedPath}?preview=true`
    }

    // Fallback for manifests without pages array
    if (pageId === 'home') return `${baseOrigin}/?preview=true`
    return `${baseOrigin}/${pageId}?preview=true`
  }

  const deviceWidth = VIEWPORT_WIDTHS[viewport] ?? 1440

  // Compute scale factor from canvas container width
  const updateScale = useCallback(() => {
    if (!canvasRef.current) return
    const containerWidth = canvasRef.current.clientWidth - 48 // 24px padding each side
    const newScale = Math.min(1, containerWidth / deviceWidth)
    setScale(newScale)
  }, [deviceWidth])

  useEffect(() => {
    updateScale()
    const observer = new ResizeObserver(updateScale)
    if (canvasRef.current) observer.observe(canvasRef.current)
    return () => observer.disconnect()
  }, [updateScale])

  // Reload iframe when active page changes
  useEffect(() => {
    if (!iframeRef.current || !baseOrigin) return
    setIframeReady(false)
    iframeRef.current.src = getPageUrl(activePage)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, baseOrigin])

  // Send full update to iframe — injects resolved styles (manifest defaults + user overrides)
  const sendFullUpdate = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return

    const manifest = selectedTemplate?.manifest
    const resolvedData = { ...sectionData }

    // Inject resolved styles into each section (objects and arrays)
    if (manifest?.sections) {
      for (const section of manifest.sections) {
        const raw = resolvedData[section.id]
        if (!raw || typeof raw !== 'object') continue

        if (Array.isArray(raw)) {
          // Array sections: wrap with section-level styles so preview can apply them
          if (section.styleControls) {
            const sectionCopy: Record<string, any> = { [section.id]: raw }
            // Read style overrides from the __styles wrapper key
            const styleOverrides = (sectionData[`${section.id}__styles`] as Record<string, any>) ?? {}
            const resolvedStyles = resolveAllSectionStyles(section, styleOverrides)
            for (const [field, styles] of Object.entries(resolvedStyles)) {
              const styleKey = field === '__section' ? '__section__style' : `${field}__style`
              sectionCopy[styleKey] = styles
            }
            resolvedData[section.id] = sectionCopy
          }
          continue
        }

        const sectionCopy = { ...(raw as Record<string, any>) }
        const resolvedStyles = resolveAllSectionStyles(section, sectionCopy)

        for (const [field, styles] of Object.entries(resolvedStyles)) {
          const styleKey = field === '__section' ? '__section__style' : `${field}__style`
          sectionCopy[styleKey] = styles
        }

        resolvedData[section.id] = sectionCopy
      }
    }

    // Resolve collection references: replace string ID arrays with full objects from live collectionData
    if (manifest && manifest.collections?.length) {
      const liveManifest = {
        ...manifest,
        collections: manifest.collections.map((col: Collection) => ({
          ...col,
          data: collectionData[col.id] ?? col.data,
        })),
      }
      const hydrated = resolveReferences(resolvedData, liveManifest)
      Object.assign(resolvedData, hydrated)
    }

    // Helper: get items for a dynamic page (supports sourceCollection and sourceSection)
    function getDynamicItems(dynDef: any): any[] {
      if (dynDef?.sourceCollection && collectionData[dynDef.sourceCollection]) {
        return collectionData[dynDef.sourceCollection]
      }
      if (!dynDef?.sourceSection) return []
      const rawData = sectionData[dynDef.sourceSection]
      const itemsPath = dynDef.itemsPath
      return (itemsPath && rawData && !Array.isArray(rawData)
        ? (rawData as any)[itemsPath]
        : rawData ?? []) as any[]
    }

    // For dynamic pages, inject the matching array item keyed by detailSectionId from manifest
    const pageList = buildPageList(manifest, sectionData, collectionData)
    const activeEntry = pageList.find((p) => p.id === activePage)
    if (activeEntry?.kind === 'dynamic' && (activeEntry.sourceSection || activeEntry.dynamicPageId)) {
      const dynDef = manifest?.pages?.find((p: any) => p.dynamic && (p.sourceSection === activeEntry.sourceSection || p.id === activeEntry.dynamicPageId))
      const slugField = dynDef?.slugField ?? 'slug'
      const detailSectionId = dynDef?.detailSectionId ?? activeEntry.sourceSection ?? activeEntry.dynamicPageId
      const items = getDynamicItems(dynDef)
      const idx = Array.isArray(items) ? items.findIndex((item: any) => item[slugField] === activePage) : -1
      if (idx >= 0 && detailSectionId) {
        resolvedData[detailSectionId] = items[idx]
        // Merge shared labels into the detail section so the preview runtime can apply them
        // (label fields live inside data-dr-section=detailSectionId in the HTML)
        const sharedSectionId: string | undefined = dynDef?.sharedSectionId
        if (sharedSectionId && sectionData[sharedSectionId]) {
          resolvedData[detailSectionId] = {
            ...(resolvedData[detailSectionId] as Record<string, any>),
            ...(sectionData[sharedSectionId] as Record<string, any>),
          }
        }
      }
    }

    // For dynamic-parent pages, inject first item data + merge shared labels
    if (activeEntry?.kind === 'dynamic-parent' && activeEntry.sourceSection) {
      const dynDef = manifest?.pages?.find(
        (p: any) => p.dynamic && p.id === activeEntry.dynamicPageId
      )
      const detailSectionId = dynDef?.detailSectionId ?? activeEntry.sourceSection
      const items = getDynamicItems(dynDef)

      // Inject first item so preview has content to display
      if (Array.isArray(items) && items.length > 0) {
        resolvedData[detailSectionId] = { ...items[0] }
      }

      // Merge shared labels into the detail section so the preview runtime can apply them
      // (label fields live inside data-dr-section=detailSectionId in the HTML, not their own section)
      const sharedSectionId: string | undefined = dynDef?.sharedSectionId
      if (sharedSectionId && sectionData[sharedSectionId]) {
        resolvedData[detailSectionId] = {
          ...(resolvedData[detailSectionId] as Record<string, any>),
          ...(sectionData[sharedSectionId] as Record<string, any>),
        }
      }
    }

    // Replace any blob URLs with their data URL equivalents before sending cross-origin.
    // Blob URLs are origin-bound and can't be loaded by a cross-origin iframe.
    const dataUrlMap = useWizardStore.getState().dataUrls
    const finalData = Object.keys(dataUrlMap).length > 0
      ? deepReplaceBlobUrls(resolvedData, dataUrlMap)
      : resolvedData

    iframe.contentWindow.postMessage(
      { type: 'full-update', data: finalData, sections: sectionsRegistry },
      getIframeOrigin(effectivePreviewUrl)
    )
  }, [sectionData, collectionData, sectionsRegistry, selectedTemplate, activePage, effectivePreviewUrl, dataUrls])

  const debouncedSendFullUpdate = useDebouncedCallback(sendFullUpdate, 80)

  // Listen for messages from iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Accept localhost and same-origin messages only
      const origin = event.origin
      if (
        origin !== window.location.origin
        && origin !== baseOrigin
        && !origin.startsWith('http://localhost')
        && !origin.startsWith('http://127.0.0.1')
      ) {
        return
      }

      const msg = event.data
      if (!msg || typeof msg !== 'object' || !msg.type) return

      switch (msg.type) {
        case 'ready':
          if (iframeLoadFallbackRef.current) clearTimeout(iframeLoadFallbackRef.current)
          setIframeReady(true)
          sendFullUpdate()
          break

        case 'element-selected':
          if (typeof msg.sectionId !== 'string' || typeof msg.field !== 'string') return
          setSelection({
            mode: msg.elementType === 'image' ? 'image' : 'section',
            sectionId: msg.sectionId,
            field: msg.field,
            elementType: msg.elementType === 'image' ? 'image' : 'text',
            content: typeof msg.content === 'string' ? msg.content : '',
          })
          break

        case 'field-edited':
          if (typeof msg.sectionId !== 'string' || typeof msg.field !== 'string') return
          lastInlineEditTimestamp.current = Date.now()
          updateField(msg.sectionId, msg.field, msg.value)
          break

        case 'image-replace-requested':
          if (typeof msg.sectionId !== 'string' || typeof msg.field !== 'string') return
          pendingImageRef.current = { sectionId: msg.sectionId, field: msg.field }
          fileInputRef.current?.click()
          break

        case 'deselect':
          clearSelection()
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [sendFullUpdate, updateField, setSelection, clearSelection, baseOrigin])

  // Re-send full update whenever data or dataUrls changes and iframe is ready (debounced for keystroke perf)
  // Skip if inline edit happened very recently (prevents feedback loop)
  useEffect(() => {
    if (!iframeReady) return
    if (Date.now() - lastInlineEditTimestamp.current < 50) return
    debouncedSendFullUpdate()
  }, [sectionData, sectionsRegistry, dataUrls, iframeReady, debouncedSendFullUpdate])

  // Re-sync iframe when switching back from data mode (data may have changed while iframe was hidden)
  const panelMode = useWizardStore((s) => s.panelMode)
  useEffect(() => {
    if (panelMode === 'layers' && iframeReady) {
      sendFullUpdate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMode])

  // Scroll iframe to the selected section when selection changes (e.g. left panel click)
  const selectedSectionId = useWizardStore((s) => s.selection.sectionId)
  useEffect(() => {
    if (!selectedSectionId || !iframeReady) return
    // Resolve labels: prefix (dynamic-parent pages) → detail: prefix for iframe scroll
    // e.g. "labels:property-detail-labels:gallery" → "detail:gallery"
    let scrollTarget = selectedSectionId
    if (scrollTarget.startsWith('labels:')) {
      const parts = scrollTarget.split(':')
      if (parts.length >= 3) {
        scrollTarget = `detail:${parts[parts.length - 1]}`
      }
    }
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'scroll-to-section', sectionId: scrollTarget },
      getIframeOrigin(effectivePreviewUrl)
    )
  }, [selectedSectionId, iframeReady, effectivePreviewUrl])

  // Fallback: if preview-runtime doesn't send 'ready' within 800ms of iframe load, force ready
  function handleIframeLoad() {
    if (iframeLoadFallbackRef.current) clearTimeout(iframeLoadFallbackRef.current)
    iframeLoadFallbackRef.current = setTimeout(() => {
      setIframeReady(true)
      sendFullUpdate()
    }, 800)
  }

  // Handle image file selection
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const pending = pendingImageRef.current
    if (!file || !pending) return

    const blobUrl = URL.createObjectURL(file)
    const key = `${pending.sectionId}.${pending.field}`
    setBlobUrl(key, blobUrl)
    updateField(pending.sectionId, pending.field, blobUrl)

    // Blob URLs are origin-bound — convert to data URL so the cross-origin iframe can display it.
    // Also store in dataUrls so sendFullUpdate substitutes it on every future full-update.
    const sectionId = pending.sectionId
    const field = pending.field
    const iframe = iframeRef.current
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setDataUrl(blobUrl, dataUrl)
      iframe?.contentWindow?.postMessage(
        { type: 'field-update', sectionId, field, value: dataUrl },
        getIframeOrigin(effectivePreviewUrl)
      )
    }
    reader.readAsDataURL(file)

    pendingImageRef.current = null
    e.target.value = ''
  }

  const iframeSrc = getPageUrl(activePage)

  return (
    <div ref={canvasRef} className="flex-1 min-w-0 bg-surface overflow-auto flex items-start justify-center py-6 px-6">
      <div
        style={{
          width: `${deviceWidth}px`,
          height: '100vh',
          transformOrigin: 'top center',
          transform: `scale(${scale})`,
          // Collapse the unused layout space below the scaled-down iframe
          marginBottom: `-${(1 - scale) * 100}vh`,
        }}
        className="relative shadow-2xl"
      >
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Template Preview"
          onLoad={handleIframeLoad}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />

        {!iframeReady && (
          <div className="absolute inset-0 bg-background/85 flex flex-col items-center justify-center gap-3 z-10">
            <div className="w-5 h-5 border-2 border-white/15 border-t-white/60 rounded-full animate-spin" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Loading
            </span>
          </div>
        )}
      </div>

      {/* Hidden file input for image replacement */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

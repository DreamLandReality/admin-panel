'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWizardStore } from '@/stores/wizard-store'
import { resolveAllSectionStyles } from '@/lib/utils/style-defaults'
import { buildPageList } from '@/lib/utils/page-list'
import { resolveReferences } from '@/lib/utils/collection-resolver'
import { getIframeOrigin } from '@/lib/utils/iframe'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import { Spinner } from '@/components/primitives'
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

export const PreviewCanvas = React.memo(function PreviewCanvas({ templatePreviewUrl, iframeRef }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [iframeReady, setIframeReady] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingImageRef = useRef<{ sectionId: string; field: string } | null>(null)
  const lastInlineEditTimestamp = useRef(0)
  const iframeLoadFallbackRef = useRef<ReturnType<typeof setTimeout>>()

  // ── Zustand selectors: subscribe only to fields needed for render/effects ──
  const viewport = useWizardStore((s) => s.viewport)
  const sectionData = useWizardStore((s) => s.sectionData)
  const collectionData = useWizardStore((s) => s.collectionData)
  const sectionsRegistry = useWizardStore((s) => s.sectionsRegistry)
  const selectedTemplate = useWizardStore((s) => s.selectedTemplate)
  const dataUrls = useWizardStore((s) => s.dataUrls)
  const activePage = useWizardStore((s) => s.activePage)
  const isViewOnly = useWizardStore((s) => s.isViewOnly)

  // Actions — stable references, never cause re-renders
  const updateField = useWizardStore((s) => s.updateField)
  const updateCollectionItem = useWizardStore((s) => s.updateCollectionItem)
  const updateArrayItemField = useWizardStore((s) => s.updateArrayItemField)
  const setSelection = useWizardStore((s) => s.setSelection)
  const clearSelection = useWizardStore((s) => s.clearSelection)
  const setBlobUrl = useWizardStore((s) => s.setBlobUrl)
  const setDataUrl = useWizardStore((s) => s.setDataUrl)

  // No localhost fallback — empty preview URL shows an error state instead
  const effectivePreviewUrl = templatePreviewUrl

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

  // Map an iframe pathname back to a pageId so the admin panel can sync activePage
  // when the runtime sends a navigate-request instead of navigating directly.
  function mapPathnameToPageId(pathname: string): string {
    if (pathname === '/' || pathname === '') return 'home'
    const manifest = selectedTemplate?.manifest
    if (!manifest) return 'home'
    // Static pages
    const staticPage = manifest.pages?.find((p: any) => !p.dynamic && p.path === pathname)
    if (staticPage) return staticPage.id
    // Dynamic pages — extract slug from path
    const dynamicPageDef = manifest.pages?.find((p: any) => p.dynamic)
    if (dynamicPageDef) {
      const basePath = dynamicPageDef.path.split('/:')[0]
      if (pathname.startsWith(basePath + '/')) {
        const slug = pathname.slice(basePath.length + 1)
        if (slug) return slug
      }
    }
    // Fallback: strip leading slash
    return pathname.slice(1) || 'home'
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
      { type: 'full-update', data: finalData, sections: sectionsRegistry, editabilityMap: useWizardStore.getState().editabilityMap, isViewOnly, viewport: useWizardStore.getState().viewport },
      getIframeOrigin(effectivePreviewUrl)
    )
  }, [sectionData, collectionData, sectionsRegistry, selectedTemplate, activePage, effectivePreviewUrl, dataUrls])

  const debouncedSendFullUpdate = useDebouncedCallback(sendFullUpdate, 80)

  // Route a field/value update from a detail: sub-section to the underlying source item.
  // sendFullUpdate reads from collectionData/sectionData items — NOT from sectionData["detail:core"]
  // (that's a dead slot). Both handleFileChange and the field-edited handler use this.
  const routeDetailPageUpdate = useCallback((field: string, value: any) => {
    const { sectionData: sd, collectionData: cd } = useWizardStore.getState()
    const manifest = selectedTemplate?.manifest
    const pageList = buildPageList(manifest, sd, cd)
    const activeEntry = pageList.find((p: any) => p.id === activePage)
    const dynDef = manifest?.pages?.find(
      (p: any) => p.dynamic && (p.id === activeEntry?.dynamicPageId || p.sourceSection === activeEntry?.sourceSection)
    )
    if (!dynDef) return
    const slugField = dynDef.slugField ?? 'slug'
    if (dynDef.sourceCollection && cd[dynDef.sourceCollection]) {
      const items = cd[dynDef.sourceCollection]
      const item = items.find((i: any) => i[slugField] === activePage)
      if (item?.id) updateCollectionItem(dynDef.sourceCollection, item.id, field, value)
    } else if (dynDef.sourceSection) {
      const rawData = sd[dynDef.sourceSection]
      const itemsPath = dynDef.itemsPath
      const items = (itemsPath && rawData && !Array.isArray(rawData)
        ? (rawData as any)[itemsPath]
        : rawData ?? []) as any[]
      const idx = Array.isArray(items) ? items.findIndex((i: any) => i[slugField] === activePage) : -1
      if (idx >= 0) updateArrayItemField(dynDef.sourceSection, idx, field, value, dynDef.itemsPath)
    }
  }, [selectedTemplate, activePage, updateCollectionItem, updateArrayItemField])

  // Listen for messages from iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Accept same-origin and template preview origin; localhost only in development
      const origin = event.origin
      const isLocalhost = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')
      if (
        origin !== window.location.origin
        && origin !== baseOrigin
        && !(process.env.NODE_ENV !== 'production' && isLocalhost)
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

        case 'component-selected':
          if (typeof msg.sectionId !== 'string' || typeof msg.fieldPath !== 'string') return
          // Handle page switching if needed
          if (msg.pageId && msg.pageId !== activePage) {
            useWizardStore.getState().setActivePage(msg.pageId)
            // Wait for page to load before setting selection
            setTimeout(() => {
              setSelection({
                mode: 'section',
                sectionId: msg.sectionId,
                field: msg.fieldPath,
                elementType: msg.fieldType === 'image' ? 'image' : 'text',
                content: '',
              })
              // Dispatch custom event for left panel to focus
              window.dispatchEvent(new CustomEvent('editor:focus-section', { detail: { sectionId: msg.sectionId } }))
            }, 100)
          } else {
            setSelection({
              mode: 'section',
              sectionId: msg.sectionId,
              field: msg.fieldPath,
              elementType: msg.fieldType === 'image' ? 'image' : 'text',
              content: '',
            })
            // Dispatch custom event for left panel to focus
            window.dispatchEvent(new CustomEvent('editor:focus-section', { detail: { sectionId: msg.sectionId } }))
          }
          break

        case 'element-selected':
          if (typeof msg.sectionId !== 'string' || typeof msg.field !== 'string') return
          setSelection({
            mode: msg.elementType === 'image' ? 'image' : 'section',
            sectionId: msg.sectionId,
            field: msg.field,
            elementType: msg.elementType === 'image' ? 'image' : 'text',
            content: typeof msg.content === 'string' ? msg.content : '',
            itemIndex: typeof msg.itemIndex === 'number' ? msg.itemIndex : null,
          })
          window.dispatchEvent(new CustomEvent('editor:focus-section', { detail: { sectionId: msg.sectionId } }))
          break

        case 'field-edited':
          if (typeof msg.sectionId !== 'string' || typeof msg.field !== 'string') return
          lastInlineEditTimestamp.current = Date.now()
          // detail: sub-sections (e.g. "detail:core") are dead slots in sectionData —
          // sendFullUpdate reads from collectionData/sectionData items, so route there.
          if (msg.sectionId.startsWith('detail:')) {
            routeDetailPageUpdate(msg.field, msg.value)
          } else if (typeof msg.listName === 'string' && typeof msg.itemIndex === 'number') {
            // Inline edit of a field inside an array item
            useWizardStore.getState().updateArrayItemField(
              msg.sectionId, msg.itemIndex, msg.field, msg.value, msg.listName
            )
          } else {
            updateField(msg.sectionId, msg.field, msg.value)
          }
          break

        case 'image-replace-requested':
          if (typeof msg.sectionId !== 'string' || typeof msg.field !== 'string') return
          pendingImageRef.current = { sectionId: msg.sectionId, field: msg.field }
          fileInputRef.current?.click()
          break

        case 'deselect':
          clearSelection()
          break

        case 'navigate-request': {
          if (typeof msg.pathname !== 'string') break
          const targetPageId = mapPathnameToPageId(msg.pathname)
          if (targetPageId !== activePage) {
            useWizardStore.getState().setActivePage(targetPageId)
            clearSelection()
          }
          break
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [sendFullUpdate, updateField, routeDetailPageUpdate, setSelection, clearSelection, baseOrigin])

  // Re-send data to iframe whenever sectionData/sectionsRegistry/dataUrls changes.
  // Optimization: if the change was a simple field edit (tracked via lastFieldUpdate),
  // send a lightweight field-update message instead of the heavy full-update.
  const lastFieldUpdate = useWizardStore((s) => s.lastFieldUpdate)
  const prevFieldUpdateRef = useRef<typeof lastFieldUpdate>(null)

  useEffect(() => {
    if (!iframeReady) return
    if (Date.now() - lastInlineEditTimestamp.current < 50) return

    // Check if this change was a single field update (not a bulk operation)
    const lfu = lastFieldUpdate
    if (
      lfu &&
      lfu !== prevFieldUpdateRef.current &&
      lfu.ts > Date.now() - 100 &&
      typeof lfu.value !== 'object' && // skip objects/arrays — need full-update for structural changes
      !String(lfu.value).startsWith('blob:') // skip blob URLs — need dataUrl resolution via full-update
    ) {
      prevFieldUpdateRef.current = lfu
      const iframe = iframeRef.current
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(
          { type: 'field-update', sectionId: lfu.sectionId, field: lfu.field, value: lfu.value },
          getIframeOrigin(effectivePreviewUrl)
        )
      }
      return
    }
    prevFieldUpdateRef.current = lfu

    // Fallback: send full update for bulk operations, section toggles, etc.
    debouncedSendFullUpdate()
  }, [sectionData, sectionsRegistry, dataUrls, iframeReady, debouncedSendFullUpdate, lastFieldUpdate, effectivePreviewUrl])

  // Notify iframe when viewport changes so the runtime can re-apply responsive styles.
  // Covers ALL sources of viewport change (toolbar buttons AND responsive slider tabs).
  useEffect(() => {
    if (!iframeReady) return
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'viewport-change', viewport },
      getIframeOrigin(effectivePreviewUrl)
    )
  }, [viewport, iframeReady, effectivePreviewUrl])

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

    // detail: sub-sections are dead slots — route to the underlying source item.
    if (pending.sectionId.startsWith('detail:')) {
      routeDetailPageUpdate(pending.field, blobUrl)
    } else {
      updateField(pending.sectionId, pending.field, blobUrl)
    }

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

  // Use about:blank when no preview URL so the iframe never loads localhost
  const iframeSrc = templatePreviewUrl ? getPageUrl(activePage) : 'about:blank'

  return (
    <div ref={canvasRef} className="relative z-0 flex flex-1 min-w-0 items-start justify-center overflow-auto bg-surface px-6 py-6">
      <div
        style={{
          width: `${deviceWidth}px`,
          height: '100vh',
          transformOrigin: 'top center',
          transform: `scale(${scale})`,
          // Collapse the unused layout space below the scaled-down iframe
          marginBottom: `-${(1 - scale) * 100}vh`,
        }}
        className="relative z-0 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)]"
      >
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Template Preview"
          onLoad={handleIframeLoad}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />

        {!iframeReady && templatePreviewUrl && (
          <div className="absolute inset-0 bg-background/85 flex flex-col items-center justify-center gap-3 z-10">
            <Spinner size="md" variant="light" />
            <span className="text-label uppercase tracking-loose text-muted-foreground">
              Loading
            </span>
          </div>
        )}

        {!templatePreviewUrl && (
          <div className="absolute inset-0 bg-surface flex flex-col items-center justify-center gap-2 z-10">
            <p className="text-sm text-muted-foreground">Preview unavailable</p>
            <p className="text-xs text-muted-foreground/60">This template has no preview URL configured.</p>
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
})

// Shared utility: build a flat list of all pages in a template
// Used by left-panel.tsx and PanelPagePicker in right-panel.tsx
import { getManifestDefaultPageId } from './manifest-contract'

export type PageEntry = {
  kind: 'static' | 'dynamic' | 'dynamic-parent'
  id: string        // manifest page id | '<slug>' | '__parent:<pageId>'
  name: string
  path: string
  dynamicPageId?: string   // manifest page.id that generated this (e.g. "property-detail")
  sourceSection?: string   // section ID the dynamic page draws from (e.g. "properties")
  itemIndex?: number       // index within the source section array
  // dynamic-parent specific:
  detailSectionId?: string   // data-dr-section value in the detail page HTML (e.g. "property-details")
  firstChildSlug?: string    // slug of first child item (used by preview to load a real page)
}

export function buildPageList(
  manifest: any,
  sectionData: Record<string, any>,
  collectionData?: Record<string, any[]>
): PageEntry[] {
  const pages: PageEntry[] = []
  const seenIds = new Set<string>()

  // 1. Static pages from manifest.pages (non-dynamic)
  for (const p of manifest?.pages ?? []) {
    if (p.dynamic) continue
    if (!seenIds.has(p.id)) {
      pages.push({ kind: 'static', id: p.id, name: p.name, path: p.path ?? `/${p.id}` })
      seenIds.add(p.id)
    }
  }

  // 2. Implicit pages derived from section.page values (backward compat)
  const defaultPageId = getManifestDefaultPageId(manifest)
  for (const section of manifest?.sections ?? []) {
    const pg = section.page
    if (pg && pg !== '*' && pg !== defaultPageId && !seenIds.has(pg)) {
      pages.push({ kind: 'static', id: pg, name: section.name, path: `/${pg}` })
      seenIds.add(pg)
    }
  }

  // 3. Dynamic pages from manifest.pages[].dynamic declarations
  //    Each dynamic page points to a sourceSection (or sourceCollection) whose array items generate pages
  for (const p of manifest?.pages ?? []) {
    if (!p.dynamic) continue
    if (!p.sourceSection && !p.sourceCollection) continue
    const slugField = p.slugField ?? 'slug'

    // Resolve items: prefer sourceCollection (Phase 2), fall back to sourceSection
    let items: any[]
    if (p.sourceCollection && collectionData?.[p.sourceCollection]) {
      items = collectionData[p.sourceCollection]
    } else if (p.sourceSection) {
      const rawData = sectionData[p.sourceSection]
      // Support object-with-items (e.g. { items: [...] }) via itemsPath, or flat arrays
      items = (p.itemsPath && rawData && !Array.isArray(rawData)
        ? (rawData as any)[p.itemsPath]
        : rawData ?? []) as any[]
    } else {
      continue
    }
    if (!Array.isArray(items)) continue

    // Insert parent entry before children
    const parentId = `__parent:${p.id}`
    if (!seenIds.has(parentId)) {
      pages.push({
        kind: 'dynamic-parent',
        id: parentId,
        name: p.name,
        path: p.path,
        dynamicPageId: p.id,
        sourceSection: p.sourceSection,
        detailSectionId: p.detailSectionId,
        firstChildSlug: items[0]?.[slugField] ?? undefined,
      })
      seenIds.add(parentId)
    }

    items.forEach((item: any, i: number) => {
      const slug = item[slugField]
      if (!slug) return
      if (seenIds.has(slug)) return
      const resolvedPath = p.path.replace(`:${slugField}`, slug)
      pages.push({
        kind: 'dynamic',
        id: slug,
        name: item.title ?? item.name ?? `Item ${i + 1}`,
        path: resolvedPath,
        dynamicPageId: p.id,
        sourceSection: p.sourceSection,
        itemIndex: i,
      })
      seenIds.add(slug)
    })
  }

  // 4. Fallback: dynamic pages from array-type sections not covered by manifest declarations
  //    (backward compat for manifests without dynamic page entries)
  const declaredSources = new Set(
    (manifest?.pages ?? []).filter((p: any) => p.dynamic).map((p: any) => p.sourceSection)
  )
  for (const section of manifest?.sections ?? []) {
    if (declaredSources.has(section.id)) continue
    // Support both pure array sections and object sections with embedded arrays
    const raw = sectionData[section.id]
    let items: any[]
    if (section.schema?.type === 'array' && Array.isArray(raw)) {
      items = raw
    } else if (section.schema?.type === 'object' && raw && !Array.isArray(raw) && Array.isArray((raw as any).items)) {
      items = (raw as any).items
    } else {
      continue
    }
    items.forEach((item: any, i: number) => {
      if (!item.slug) return
      if (seenIds.has(item.slug)) return
      pages.push({
        kind: 'dynamic',
        id: item.slug,
        name: item.title ?? `Item ${i + 1}`,
        path: `/${section.id}/${item.slug}`,
        sourceSection: section.id,
        itemIndex: i,
      })
      seenIds.add(item.slug)
    })
  }

  return pages
}

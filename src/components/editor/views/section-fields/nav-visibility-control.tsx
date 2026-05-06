'use client'

import { PanelToggle } from '../../inputs'
import { canShowSectionInNav } from '@/lib/utils/manifest-contract'
import type { ManifestSection, SectionRegistry, TemplateManifest } from '@/types'

interface NavVisibilityControlProps {
  sectionId: string
  section: ManifestSection | undefined
  manifest: TemplateManifest | undefined
  sectionsRegistry: Record<string, SectionRegistry>
  onToggle: (sectionId: string, showInNav: boolean) => void
}

export function NavVisibilityControl({
  sectionId,
  section,
  manifest,
  sectionsRegistry,
  onToggle,
}: NavVisibilityControlProps) {
  if (!canShowSectionInNav(section, manifest)) return null

  const showInNav = sectionsRegistry[sectionId]?.showInNav ?? (section?.showInNav === true)

  return (
    <div className="border-b border-white/5 px-4 py-3">
      <PanelToggle
        label="Show in navbar"
        value={showInNav}
        onChange={(value) => onToggle(sectionId, value)}
      />
    </div>
  )
}

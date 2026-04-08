'use client'

import { useEffect, useState } from 'react'
import { TemplateCard } from '@/components/shared/template-card'
import { EditorShell } from '@/components/editor/editor-shell'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Skeleton } from '@/components/ui'
import { useWizardStore } from '@/stores/wizard-store'
import type { Template } from '@/types'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const isViewOnly = useWizardStore((s) => s.isViewOnly)
  const selectedTemplate = useWizardStore((s) => s.selectedTemplate)
  const reset = useWizardStore((s) => s.reset)
  const selectTemplate = useWizardStore((s) => s.selectTemplate)
  const loadManualDefaults = useWizardStore((s) => s.loadManualDefaults)
  const setViewOnly = useWizardStore((s) => s.setViewOnly)

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then((data) => setTemplates(data.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function handleView(template: Template) {
    reset()
    selectTemplate(template)
    loadManualDefaults(template)
    setViewOnly(true)
  }

  // Show editor as full-screen overlay — no navigation needed
  if (isViewOnly && selectedTemplate) {
    return <EditorShell />
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-card w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        heading="No templates available"
        description="Check back soon — templates will appear here when they are published."
        ctaLabel=""
        ctaHref=""
      />
    )
  }

  return (
    <div className={
      templates.length === 1
        ? 'grid gap-5 max-w-xs'
        : 'grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4'
    }>
      {templates.map((template, idx) => (
        <TemplateCard
          key={template.id}
          template={template}
          onSelect={handleView}
          index={idx}
        />
      ))}
    </div>
  )
}

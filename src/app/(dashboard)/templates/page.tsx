'use client'

import { useEffect, useState } from 'react'
import { TemplateCard } from '@/components/wizard/step-template-picker'
import { EditorShell } from '@/components/editor/editor-shell'
import { useWizardStore } from '@/stores/wizard-store'
import type { Template } from '@/types'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const { isViewOnly, selectedTemplate, reset, selectTemplate, loadManualDefaults, setViewOnly } = useWizardStore()

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
      <div className="flex items-center justify-center min-h-[40vh]">
        <span className="w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <p className="font-serif text-2xl text-foreground mb-2">No templates available</p>
        <p className="text-sm text-foreground-muted">Check back soon.</p>
      </div>
    )
  }

  return (
    <div className={
      templates.length === 1
        ? 'grid gap-5 max-w-xs'
        : 'grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4'
    }>
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          onSelect={handleView}
        />
      ))}
    </div>
  )
}

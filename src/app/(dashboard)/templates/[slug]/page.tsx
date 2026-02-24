'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { EditorShell } from '@/components/editor/editor-shell'
import { useWizardStore } from '@/stores/wizard-store'
import type { Template } from '@/types'

export default function TemplateViewerPage() {
  const { slug } = useParams<{ slug: string }>()
  const [ready, setReady] = useState(false)
  const { reset, selectTemplate, loadManualDefaults, setViewOnly } = useWizardStore()

  useEffect(() => {
    const controller = new AbortController()

    async function init() {
      const res = await fetch('/api/templates', { signal: controller.signal })
      const data = await res.json()
      const template: Template | undefined = (data.data ?? []).find(
        (t: Template) => t.slug === slug
      )
      if (!template) return

      reset()
      selectTemplate(template)
      loadManualDefaults(template)
      setViewOnly(true)
      setReady(true)
    }

    init().catch((err) => {
      if (err.name !== 'AbortError') console.error('[TemplateViewer]', err)
    })

    return () => {
      controller.abort()
      reset()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    )
  }

  return <EditorShell />
}

'use client'

import { useEffect, useState } from 'react'
import { useWizardStore } from '@/stores/wizard-store'
import { EditorShell } from '@/components/editor/editor-shell'
import type { Deployment, Template } from '@/types'

export function EditDeploymentLoader({
  deployment,
  template,
}: {
  deployment: Deployment
  template: Template
}) {
  const loadFromDeployment = useWizardStore((s) => s.loadFromDeployment)

  // Gates EditorShell render — must be true before the editor mounts.
  // Without this, EditorShell renders on the first pass before useEffect
  // runs loadFromDeployment, showing an empty/stale editor.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadFromDeployment(deployment, template)
    setReady(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return null

  return <EditorShell />
}

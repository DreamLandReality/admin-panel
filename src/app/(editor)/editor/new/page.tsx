'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { EditorShell } from '@/components/editor/editor-shell'
import { useWizardStore } from '@/stores/wizard-store'
import { ROUTES } from '@/lib/constants'

export default function EditorNewPage() {
  const router = useRouter()
  const selectedTemplate = useWizardStore((s) => s.selectedTemplate)

  useEffect(() => {
    if (!selectedTemplate) {
      router.replace(ROUTES.newDeployment)
    }
  }, [selectedTemplate, router])

  if (!selectedTemplate) return null

  return <EditorShell />
}

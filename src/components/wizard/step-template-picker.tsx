'use client'

import { useState } from 'react'
import { useWizardStore } from '@/stores/wizard-store'
import { EmptyState } from '@/components/dashboard/empty-state'
import { TemplateCard } from '@/components/shared/template-card'
import { CardGrid } from '@/components/layout/CardGrid'
import { Heading } from '@/components/primitives'
import type { Template } from '@/types'

interface StepTemplatePickerProps {
  templates: Template[]
}

export function StepTemplatePicker({ templates }: StepTemplatePickerProps) {
  const selectTemplate = useWizardStore((s) => s.selectTemplate)
  const setStep = useWizardStore((s) => s.setStep)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  function handleSelect(template: Template) {
    setSelectedId(template.id)
    selectTemplate(template)
    setStep(2)
  }

  return (
    <div className="w-full flex-1 flex flex-col">
      <div className="max-w-5xl">
        <div className="mb-10">
          <Heading variant="page-title" as="h1">
            Choose a template
          </Heading>
          <p className="text-muted-foreground mt-2 text-body-sm leading-relaxed tracking-wide">
            Pick the design that best fits your property.
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="flex-1 flex items-center justify-center w-full pb-20">
          <EmptyState
            heading="No templates available"
            description="Templates will appear here once they are added to the system."
            ctaLabel=""
            ctaHref=""
          />
        </div>
      ) : (
        <CardGrid
          columns={templates.length === 1 ? 1 : 4}
          className={templates.length === 1 ? 'max-w-xs' : ''}
        >
          {templates.map((template, idx) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={template.id === selectedId}
              onSelect={handleSelect}
              index={idx}
            />
          ))}
        </CardGrid>
      )}
    </div>
  )
}

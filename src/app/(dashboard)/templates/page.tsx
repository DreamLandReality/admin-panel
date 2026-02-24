import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TemplateCard } from '@/components/wizard/step-template-picker'
import { ROUTES } from '@/lib/constants'
import type { Template } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TemplatesPage() {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: templates, error: queryError } = await supabase
    .from('templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (queryError) {
    console.error('Failed to fetch templates:', queryError)
  }

  const typedTemplates = (templates ?? []) as Template[]

  if (typedTemplates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <p className="font-serif text-2xl text-foreground mb-2">No templates available</p>
        <p className="text-sm text-foreground-muted">Check back soon.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 max-w-5xl">
      {typedTemplates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          href={ROUTES.template(template.slug)}
        />
      ))}
    </div>
  )
}

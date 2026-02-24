import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildParsePrompt } from '@/lib/ai/parse-prompt'
import { buildToolSchema } from '@/lib/ai/schema-to-tool'
import { createRateLimiter } from '@/lib/rate-limit'
import type { ManifestSection } from '@/types'

const MAX_TEXT_LENGTH = 50_000

/** Recursively merge source into target. Source wins for primitives; objects merge recursively; arrays replace. */
function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const srcVal = source[key]
    if (srcVal == null) continue
    if (Array.isArray(srcVal)) {
      result[key] = srcVal
    } else if (typeof srcVal === 'object' && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], srcVal)
    } else {
      result[key] = srcVal
    }
  }
  return result
}
const parseLimiter = createRateLimiter({ windowMs: 60_000, max: 10 })

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited, remaining } = parseLimiter.check(user.id)
  if (limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
    )
  }

  const body = await req.json()
  const { templateId, rawText } = body as { templateId?: string; rawText?: string }

  if (!templateId || !rawText?.trim()) {
    return NextResponse.json({ error: 'templateId and rawText are required' }, { status: 400 })
  }
  if (rawText.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: `Text exceeds ${MAX_TEXT_LENGTH.toLocaleString()} character limit` }, { status: 400 })
  }

  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .eq('is_active', true)
    .single()

  if (templateError || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const sections: ManifestSection[] = template.manifest?.sections ?? []
  const { systemPrompt, userPrompt } = buildParsePrompt(sections, rawText.trim())
  const tool = buildToolSchema(sections)

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [tool],
      tool_choice: { type: 'tool', name: 'save_property_data' },
    })
  } catch (err: any) {
    console.error('[parse] Anthropic API error:', err)
    return NextResponse.json(
      { error: err.message || 'AI service error' },
      { status: 502 }
    )
  }

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'AI did not return structured data' }, { status: 500 })
  }

  const aiData = toolUse.input as Record<string, any>

  // Deep merge: AI data wins over template defaults for non-null values
  const merged: Record<string, any> = { ...(template.default_data ?? {}) }
  for (const [sectionId, sectionData] of Object.entries(aiData)) {
    if (sectionData == null) continue
    if (Array.isArray(sectionData)) {
      // Array sections — replace directly, no merge
      merged[sectionId] = sectionData
    } else if (typeof sectionData === 'object') {
      // Object sections — deep merge preserves nested defaults (e.g. cta.href)
      merged[sectionId] = deepMerge(merged[sectionId] ?? {}, sectionData)
    }
  }

  // Build sections registry — all sections enabled by default
  const _sections: Record<string, { enabled: boolean }> = {}
  sections.forEach((s) => { _sections[s.id] = { enabled: true } })

  return NextResponse.json({
    sectionData: merged,
    _sections,
    provider: 'claude',
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  })
}

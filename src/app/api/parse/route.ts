import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildParsePrompt } from '@/lib/ai/parse-prompt'
import { buildToolSchema } from '@/lib/ai/schema-to-tool'
import { createRateLimiter } from '@/lib/rate-limit'
import type { ManifestSection } from '@/types'

const MAX_TEXT_LENGTH = 50_000
const TIMEOUT_MS = 3 * 60 * 1000
const HEARTBEAT_MS = 5_000

const CLAUDE_MODEL = process.env.ANTHROPIC_PARSE_MODEL ?? 'claude-sonnet-4-5-20250929'
const GEMINI_MODEL = process.env.GEMINI_PARSE_MODEL ?? 'gemini-3-flash'

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

/**
 * Convert a Claude tool input_schema to Gemini function declaration parameters.
 * Gemini requires uppercase type names ("OBJECT", "STRING", etc.).
 */
function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema
  const result: any = {}

  if (schema.type) {
    const t = (schema.type as string).toUpperCase()
    if (['STRING', 'NUMBER', 'INTEGER', 'BOOLEAN', 'ARRAY', 'OBJECT'].includes(t)) {
      result.type = t
    } else {
      result.type = 'STRING'
    }
  }

  if (schema.description) result.description = schema.description
  if (schema.enum) result.enum = schema.enum
  if (schema.properties) {
    result.properties = {}
    for (const [k, v] of Object.entries(schema.properties as Record<string, any>)) {
      result.properties[k] = toGeminiSchema(v)
    }
  }
  if (schema.items) result.items = toGeminiSchema(schema.items)
  if (schema.required && result.properties) {
    const filtered = (schema.required as string[]).filter((k: string) => k in result.properties)
    if (filtered.length) result.required = filtered
  }
  return result
}

/** Claude — forced tool_use, returns structured property data. */
async function runClaude(
  systemPrompt: string,
  userPrompt: string,
  tool: ReturnType<typeof buildToolSchema>,
  signal: AbortSignal
): Promise<Record<string, any>> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [tool],
      tool_choice: { type: 'tool', name: 'save_property_data' },
    },
    { signal }
  )

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') throw new Error('Claude did not return structured data')
  return toolUse.input as Record<string, any>
}

/** Gemini — forced function calling via REST API, returns structured property data. */
async function runGemini(
  systemPrompt: string,
  userPrompt: string,
  tool: ReturnType<typeof buildToolSchema>,
  signal: AbortSignal
): Promise<Record<string, any>> {
  if (!process.env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY is not configured')

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    tools: [{
      function_declarations: [{
        name: tool.name,
        description: tool.description,
        parameters: toGeminiSchema(tool.input_schema),
      }],
    }],
    tool_config: {
      function_calling_config: {
        mode: 'ANY',
        allowed_function_names: [tool.name],
      },
    },
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GOOGLE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Gemini API error ${res.status}`)
  }

  const data = await res.json()
  const part = data?.candidates?.[0]?.content?.parts?.[0]
  if (!part?.functionCall?.args) throw new Error('Gemini did not return structured data')
  return part.functionCall.args as Record<string, any>
}

const parseLimiter = createRateLimiter({ windowMs: 60_000, max: 10 })

function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

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
  const { templateId, rawText, provider = 'claude' } = body as {
    templateId?: string
    rawText?: string
    provider?: 'claude' | 'gemini'
  }

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

  const stream = new ReadableStream({
    async start(controller) {
      const aiController = new AbortController()

      const heartbeat = setInterval(() => {
        try { controller.enqueue(sseEvent({ type: 'ping' })) } catch { /* stream closed */ }
      }, HEARTBEAT_MS)

      const timeout = setTimeout(() => {
        aiController.abort()
        try {
          controller.enqueue(sseEvent({ type: 'error', message: 'Request timed out after 3 minutes. Please try again.' }))
          controller.close()
        } catch { /* already closed */ }
      }, TIMEOUT_MS)

      try {
        const aiData = provider === 'gemini'
          ? await runGemini(systemPrompt, userPrompt, tool, aiController.signal)
          : await runClaude(systemPrompt, userPrompt, tool, aiController.signal)

        // Deep merge: AI data wins over template defaults for non-null values
        const merged: Record<string, any> = { ...(template.default_data ?? {}) }
        for (const [sectionId, sectionData] of Object.entries(aiData)) {
          if (sectionData == null) continue
          if (Array.isArray(sectionData)) {
            merged[sectionId] = sectionData
          } else if (typeof sectionData === 'object') {
            merged[sectionId] = deepMerge(merged[sectionId] ?? {}, sectionData)
          }
        }

        const _sections: Record<string, { enabled: boolean }> = {}
        sections.forEach((s) => { _sections[s.id] = { enabled: true } })

        let populatedSections = 0
        for (const val of Object.values(aiData)) {
          if (val == null) continue
          if (Array.isArray(val) && val.length > 0) { populatedSections++; continue }
          if (typeof val === 'object' && Object.values(val as Record<string, any>).some((f) => f != null)) {
            populatedSections++
          }
        }
        const parseQuality: 'ok' | 'low' | 'empty' =
          populatedSections === 0 ? 'empty' : populatedSections < 3 ? 'low' : 'ok'

        controller.enqueue(sseEvent({ type: 'result', sectionData: merged, _sections, provider, parseQuality }))
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(`[parse] ${provider} error:`, err)
          try { controller.enqueue(sseEvent({ type: 'error', message: err.message || 'AI service error' })) } catch { /* closed */ }
        }
      } finally {
        clearInterval(heartbeat)
        clearTimeout(timeout)
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

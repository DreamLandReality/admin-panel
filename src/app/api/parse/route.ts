import Anthropic from '@anthropic-ai/sdk'
import { requireCapability } from '@/lib/api/auth'
import { isRecord } from '@/lib/api/contracts'
import { apiError } from '@/lib/api/response'
import { parseJsonRecordBody } from '@/lib/api/request'
import { buildToolSchema } from '@/lib/ai/schema-to-tool'
import { createRateLimiter } from '@/lib/rate-limit'
import { log } from '@/lib/log'
import { buildParsePrompt } from '@/prompts'
import type { JsonObject, JsonValue, ManifestSection } from '@/types'

const MAX_TEXT_LENGTH = 50_000
const TIMEOUT_MS = 3 * 60 * 1000
const HEARTBEAT_MS = 5_000

const CLAUDE_MODEL = process.env.ANTHROPIC_PARSE_MODEL ?? 'claude-sonnet-4-5-20250929'
const GEMINI_MODEL = process.env.GEMINI_PARSE_MODEL ?? 'gemini-3-flash'

interface GeminiSchema {
  type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT'
  description?: string
  enum?: string[]
  properties?: Record<string, GeminiSchema>
  items?: GeminiSchema
  required?: string[]
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return isRecord(value)
}

function asJsonObject(value: unknown, fallback: JsonObject = {}): JsonObject {
  return isRecord(value) ? value as JsonObject : fallback
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'AI service error'
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function getNestedMessage(value: unknown, path: string[]): string | null {
  let current: unknown = value
  for (const key of path) {
    if (!isRecord(current)) return null
    current = current[key]
  }
  return typeof current === 'string' ? current : null
}

/** Recursively merge source into target. Source wins for primitives; objects merge recursively; arrays replace. */
function deepMerge(target: JsonObject, source: JsonObject): JsonObject {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const srcVal = source[key]
    if (srcVal == null) continue
    if (Array.isArray(srcVal)) {
      result[key] = srcVal
    } else if (isJsonObject(srcVal) && isJsonObject(result[key])) {
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
function toGeminiSchema(schema: unknown): GeminiSchema {
  if (!isRecord(schema)) return { type: 'STRING' }
  const result: GeminiSchema = { type: 'STRING' }

  const rawType = typeof schema.type === 'string' ? schema.type.toUpperCase() : undefined
  result.type = rawType && ['STRING', 'NUMBER', 'INTEGER', 'BOOLEAN', 'ARRAY', 'OBJECT'].includes(rawType)
    ? rawType as GeminiSchema['type']
    : 'STRING' // default — prevents Gemini rejecting typeless fields in required

  if (typeof schema.description === 'string') result.description = schema.description
  if (Array.isArray(schema.enum) && schema.enum.every((item) => typeof item === 'string')) {
    result.enum = schema.enum
  }
  if (isRecord(schema.properties)) {
    result.properties = {}
    for (const [k, v] of Object.entries(schema.properties)) {
      const converted = toGeminiSchema(v)
      // Only include properties that resolved to a valid schema object
      result.properties[k] = converted
    }
    result.type = 'OBJECT'
  }
  if (schema.items) {
    result.items = toGeminiSchema(schema.items)
    result.type = 'ARRAY'
  }
  const properties = result.properties
  if (Array.isArray(schema.required) && properties) {
    const filtered = schema.required.filter((key): key is string => typeof key === 'string' && key in properties)
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
): Promise<JsonObject> {
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
  return asJsonObject(toolUse.input)
}

/** Gemini — forced function calling via REST API, returns structured property data. */
async function runGemini(
  systemPrompt: string,
  userPrompt: string,
  tool: ReturnType<typeof buildToolSchema>,
  signal: AbortSignal
): Promise<JsonObject> {
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
    throw new Error(getNestedMessage(err, ['error', 'message']) ?? `Gemini API error ${res.status}`)
  }

  const data: unknown = await res.json()
  if (!isRecord(data) || !Array.isArray(data.candidates)) {
    throw new Error('Gemini did not return structured data')
  }
  const candidate = data.candidates[0]
  if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
    throw new Error('Gemini did not return structured data')
  }
  const part = candidate.content.parts[0]
  if (!isRecord(part) || !isRecord(part.functionCall)) {
    throw new Error('Gemini did not return structured data')
  }
  return asJsonObject(part.functionCall.args)
}

const parseLimiter = createRateLimiter({ windowMs: 60_000, max: 10 })

function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(req: Request) {
  const auth = await requireCapability('canCreateSites')
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const { limited, remaining } = parseLimiter.check(user.id)
  if (limited) {
    return apiError('Too many requests. Please wait before trying again.', 429, {
      headers: { 'X-RateLimit-Remaining': String(remaining) },
    })
  }

  const bodyResult = await parseJsonRecordBody(req)
  if (!bodyResult.ok) return bodyResult.response

  const { templateId, rawText, provider = 'claude' } = bodyResult.data as {
    templateId?: string
    rawText?: string
    provider?: 'claude' | 'gemini'
  }

  if (!templateId || !rawText?.trim()) {
    return apiError('templateId and rawText are required', 400)
  }
  if (rawText.length > MAX_TEXT_LENGTH) {
    return apiError(`Text exceeds ${MAX_TEXT_LENGTH.toLocaleString()} character limit`, 400)
  }

  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .eq('is_active', true)
    .single()

  if (templateError || !template) {
    return apiError('Template not found', 404)
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
        const merged: JsonObject = { ...asJsonObject(template.default_data) }
        for (const [sectionId, sectionData] of Object.entries(aiData)) {
          if (sectionData == null) continue
          if (Array.isArray(sectionData)) {
            merged[sectionId] = sectionData
          } else if (isJsonObject(sectionData)) {
            merged[sectionId] = deepMerge(asJsonObject(merged[sectionId]), sectionData)
          }
        }

        const _sections: Record<string, { enabled: boolean; showInNav?: boolean }> = {}
        sections.forEach((s) => { _sections[s.id] = { enabled: true, showInNav: s.showInNav === true } })

        let populatedSections = 0
        for (const val of Object.values(aiData)) {
          if (val == null) continue
          if (Array.isArray(val) && val.length > 0) { populatedSections++; continue }
          if (isJsonObject(val) && Object.values(val).some((fieldValue) => fieldValue != null)) {
            populatedSections++
          }
        }
        const parseQuality: 'ok' | 'low' | 'empty' =
          populatedSections === 0 ? 'empty' : populatedSections < 3 ? 'low' : 'ok'

        controller.enqueue(sseEvent({ type: 'result', sectionData: merged, _sections, provider, parseQuality }))
      } catch (err: unknown) {
        if (!isAbortError(err)) {
          log.event('error', 'ai.parse.provider_failed', 'AI parse provider failed', {
            provider,
            reason: getErrorMessage(err),
          })
          try { controller.enqueue(sseEvent({ type: 'error', message: getErrorMessage(err) })) } catch { /* closed */ }
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

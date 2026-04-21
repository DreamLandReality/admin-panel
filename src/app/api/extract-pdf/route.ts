import { NextResponse } from 'next/server'
import { extractText, getDocumentProxy } from 'unpdf'
import { createClient } from '@/lib/supabase/server'
import { createRateLimiter } from '@/lib/rate-limit'

const MAX_FILE_BYTES = 52_428_800 // 50 MB
const MAX_TEXT_CHARS = 50_000
const rateLimiter = createRateLimiter({ windowMs: 60_000, max: 5 })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { limited } = rateLimiter.check(user.id)
  if (limited) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 400 })
  }

  const uint8 = new Uint8Array(await file.arrayBuffer())

  let pageCount: number
  let rawText: string
  try {
    const pdf = await getDocumentProxy(uint8)
    pageCount = pdf.numPages
    const { text } = await extractText(pdf, { mergePages: true })
    rawText = (Array.isArray(text) ? text.join('\n') : text).trim()
  } catch {
    return NextResponse.json({ error: 'parse_failed' }, { status: 422 })
  }

  if (!rawText) {
    return NextResponse.json({ error: 'no_text' }, { status: 422 })
  }

  const truncated = rawText.length > MAX_TEXT_CHARS
  const text = truncated ? rawText.slice(0, MAX_TEXT_CHARS) : rawText

  return NextResponse.json({ text, truncated, pageCount })
}

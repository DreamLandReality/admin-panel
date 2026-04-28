import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildDraftPreviewHtml } from '@/lib/utils/draft-preview-html'
import { uploadToPrivateBucket } from '@/lib/utils/r2-storage'
import puppeteer from 'puppeteer'

/**
 * POST /api/screenshot/draft
 * Body: { draft_id: string }
 *
 * Renders the draft's section data into a styled HTML page, screenshots it
 * with Puppeteer, uploads the PNG to R2 private bucket, and patches
 * drafts.screenshot_url with the object key.
 *
 * Designed to be called fire-and-forget from the editor after a save.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let draft_id: string
  try {
    ;({ draft_id } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!draft_id) {
    return NextResponse.json({ error: 'draft_id is required' }, { status: 400 })
  }

  const { data: draft, error: fetchError } = await supabase
    .from('drafts')
    .select('id, project_name, template_slug, section_data')
    .eq('id', draft_id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  const html = buildDraftPreviewHtml({
    projectName: draft.project_name ?? 'Untitled',
    sectionData: (draft.section_data as Record<string, any>) ?? {},
    templateSlug: draft.template_slug,
  })

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 900 })
    // networkidle0 waits for background image to load (if present)
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15_000 })
    const screenshot = await page.screenshot({ type: 'png', fullPage: false })

    const objectKey = `screenshots/drafts/${draft_id}/preview.png`
    await uploadToPrivateBucket(objectKey, Buffer.from(screenshot), 'image/png')

    await supabase
      .from('drafts')
      .update({ screenshot_url: objectKey, updated_at: new Date().toISOString() })
      .eq('id', draft_id)

    return NextResponse.json({ ok: true })
  } finally {
    await browser.close()
  }
}

import { type NextRequest } from 'next/server'
import { requireCapability } from '@/lib/api/auth'
import { apiError, apiOk } from '@/lib/api/response'
import { parseJsonRecordBody } from '@/lib/api/request'
import { buildDraftPreviewHtml } from '@/lib/utils/draft-preview-html'
import { uploadToPrivateBucket } from '@/lib/utils/r2-storage'
import { log } from '@/lib/log'
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
  const auth = await requireCapability('canEditSites')
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const bodyResult = await parseJsonRecordBody(request)
  if (!bodyResult.ok) return bodyResult.response

  const { draft_id } = bodyResult.data
  if (!draft_id || typeof draft_id !== 'string') {
    return apiError('draft_id is required', 400)
  }

  const { data: draft, error: fetchError } = await supabase
    .from('drafts')
    .select('id, project_name, template_slug, section_data')
    .eq('id', draft_id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !draft) {
    return apiError('Draft not found', 404)
  }

  const html = buildDraftPreviewHtml({
    projectName: draft.project_name ?? 'Untitled',
    sectionData: (draft.section_data as Record<string, unknown>) ?? {},
    templateSlug: draft.template_slug,
  })

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 900 })
    // networkidle0 waits for background image to load (if present)
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15_000 })
    const screenshot = await page.screenshot({ type: 'png', fullPage: false })

    const objectKey = `screenshots/drafts/${draft_id}/preview.png`
    await uploadToPrivateBucket(objectKey, Buffer.from(screenshot), 'image/png')

    const { error: updateError } = await supabase
      .from('drafts')
      .update({ screenshot_url: objectKey, updated_at: new Date().toISOString() })
      .eq('id', draft_id)
      .eq('user_id', user.id)

    if (updateError) {
      return apiError(updateError.message, 500)
    }

    return apiOk({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Draft screenshot failed'
    log.event('error', 'draft.screenshot.failed', 'Draft screenshot generation failed', {
      draftId: draft_id,
      reason: message,
    })
    return apiError(message, 500)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

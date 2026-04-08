/**
 * Builds a self-contained HTML page from draft section data for Puppeteer screenshot.
 * Uses the user's real content: hero title, subtitle, background image.
 * Falls back gracefully when fields are missing.
 */
export function buildDraftPreviewHtml(params: {
  projectName: string
  sectionData: Record<string, any>
  templateSlug: string
}): string {
  const { projectName, sectionData, templateSlug } = params

  const hero     = sectionData?.hero     as Record<string, any> | undefined
  const seo      = sectionData?.seo      as Record<string, any> | undefined
  const property = sectionData?.property as Record<string, any> | undefined

  const title    = hero?.title    || hero?.headline    || projectName
  const subtitle = hero?.subtitle || hero?.tagline     || hero?.description
                || property?.location
                || seo?.description
                || ''

  const bgImage = (hero?.backgroundImage || seo?.image || null) as string | null
  const safeBg  = bgImage && bgImage.startsWith('http') ? bgImage : null

  const bgStyle = safeBg
    ? `background-image: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%), url('${safeBg}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, #0f0f1a 0%, #1a1428 50%, #0d1b2a 100%);`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 900px; overflow: hidden;
    font-family: Georgia, 'Times New Roman', serif;
    ${bgStyle}
    display: flex; flex-direction: column; justify-content: flex-end;
    padding: 64px; color: white;
  }
  .tag {
    font-size: 11px;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    letter-spacing: 0.25em; text-transform: uppercase;
    color: rgba(255,255,255,0.45); margin-bottom: 20px;
  }
  .title {
    font-size: 60px; font-weight: 400; line-height: 1.05;
    letter-spacing: -0.02em; color: #fff;
    margin-bottom: 20px; max-width: 800px;
  }
  .subtitle {
    font-size: 20px;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-weight: 300; color: rgba(255,255,255,0.6);
    letter-spacing: 0.03em; max-width: 600px;
  }
</style>
</head>
<body>
  <div class="tag">${esc(templateSlug)}</div>
  <div class="title">${esc(title)}</div>
  ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ''}
</body>
</html>`
}

function esc(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

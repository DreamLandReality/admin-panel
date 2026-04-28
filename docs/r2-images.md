# R2 Image Display in Admin Panel

The admin panel displays screenshots from a private Cloudflare R2 bucket using signed URLs generated on demand. Customer/editor upload assets use the public R2 assets bucket and CDN URL.

## Setup

### 1. Configure R2 Credentials

Add the following to your `admin-panel/.env.local` file:

```bash
CLOUDFLARE_R2_ACCESS_KEY_ID=your_r2_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
CLOUDFLARE_ACCOUNT_ID=your_r2_account_id

# Private screenshots bucket
CLOUDFLARE_R2_BUCKET_NAME=screenshots

# Public customer/template asset bucket
CLOUDFLARE_R2_ASSETS_BUCKET_NAME=assets
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-your-hash.r2.dev
```

**Note:** `CLOUDFLARE_ACCOUNT_ID` is shared with the Cloudflare Pages deployment config. The old `CLOUDFLARE_R2_ACCOUNT_ID` name is not used by the app.

### 2. Bucket Setup

- `CLOUDFLARE_R2_BUCKET_NAME` should be **private** for screenshots and signed-url reads.
- `CLOUDFLARE_R2_ASSETS_BUCKET_NAME` should be **public** for customer image uploads and template assets.
- Signed screenshot URLs are generated on demand with a 1-hour expiration by default.

## Usage

### Option 1: Use the R2Image Component (Recommended)

```tsx
import { R2Image } from '@/components/r2-image'

function TemplateCard({ template }) {
  return (
    <div>
      <R2Image
        objectKey={`screenshots/${template.slug}/preview.png`}
        alt={`${template.name} preview`}
        className="w-full h-64 object-cover rounded-lg"
        fallbackSrc="/placeholder.png"
      />
    </div>
  )
}
```

### Option 2: Use the Hook Directly

```tsx
import { useR2Image } from '@/hooks/use-r2-image'

function TemplatePreview({ objectKey }) {
  const { imageUrl, loading, error } = useR2Image(objectKey)

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return <img src={imageUrl} alt="Preview" />
}
```

### Option 3: Use the API Route

```typescript
const response = await fetch('/api/r2/signed-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    objectKey: 'screenshots/minimal-luxury/preview.png',
    expiresIn: 3600 // Optional, defaults to 1 hour
  })
})

const { url } = await response.json()
// Use the signed URL
```

## Object Key Format

Object keys follow this structure:

- **Template screenshots**: `screenshots/{template-slug}/preview.png`
- **Deployment screenshots**: `screenshots/deployments/{deployment-id}.png`
- **Customer/editor uploads**: `uploads/{deployment-id}/{filename}`
- **Shared defaults**: `shared-defaults/{template}/{asset}`

## Smart URL Handling

The `useR2Image` hook delegates signed-url reads through `imageService.getSignedUrl()` and automatically detects:

- **Full URLs** (http/https): Used directly, no signed URL generation
- **R2 object keys**: Generates signed URL via API
- **Null/undefined**: Returns null gracefully

This means template preview URLs from the database work whether they're:
1. Signed URLs already stored (from deployment script)
2. R2 object keys (generates fresh signed URL)
3. External URLs (uses directly)

## Security

- Screenshot bucket remains **private** - no public access.
- Asset bucket is intentionally public and only receives image assets through admin-controlled upload paths.
- Signed URLs expire after 1 hour by default.
- Credentials stay in environment variables.
- API routes validate input before generating URLs.

## Performance

- URLs are generated on-demand when components mount
- React hook includes cleanup to prevent memory leaks
- Consider implementing client-side caching for frequently accessed images

## Troubleshooting

**"Failed to generate signed URL" error:**
- Check R2 credentials in `.env.local`
- Verify bucket name matches R2 bucket
- Ensure API token has "Object Read & Write" permissions

**Images not loading:**
- Check browser console for errors
- Verify object key exists in R2 bucket
- Test API route directly: `POST /api/r2/signed-url`

**Performance issues:**
- Implement client-side URL caching
- Consider using Next.js Image Optimization
- Adjust `expiresIn` for longer-lived URLs (trade-off: less secure)

'use client'

import { useState } from 'react'
import { useWizardStore } from '@/stores/wizard-store'
import { mergeUserDataIntoManifest } from '@/lib/utils/deploy-merge'
import { uploadPendingImages, replaceBlobUrls } from '@/lib/utils/upload-pending-images'

export function StepDeploy() {
  const { selectedTemplate, sectionData, sectionsRegistry, collectionData, pendingImages, projectName, setStep } = useWizardStore()
  const [siteSlug, setSiteSlug] = useState('')
  const [status, setStatus] = useState<'idle' | 'uploading' | 'deploying' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<{ siteUrl?: string; repoUrl?: string; error?: string } | null>(null)

  const templateSlug = selectedTemplate?.slug
  const isValid = siteSlug && /^[a-z0-9-]+$/.test(siteSlug) && templateSlug

  async function handleDeploy() {
    if (!isValid || !templateSlug) return

    setStatus('uploading')
    setResult(null)

    try {
      // Upload any pending blob images to R2 first
      const urlMap = await uploadPendingImages(pendingImages)

      // Replace blob URLs with R2 public URLs in the data
      const finalSectionData = replaceBlobUrls(sectionData, urlMap)
      const finalCollectionData = replaceBlobUrls(collectionData, urlMap)

      setStatus('deploying')

      const mergedManifest = mergeUserDataIntoManifest(
        selectedTemplate!.manifest,
        finalSectionData,
        finalCollectionData,
        sectionsRegistry
      )

      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateSlug,
          siteSlug,
          projectName: projectName || siteSlug,
          manifest: mergedManifest,
          siteData: { ...finalSectionData, _sections: sectionsRegistry },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setResult({ error: data.error || 'Deployment failed' })
        return
      }

      setStatus('success')
      setResult({ siteUrl: data.siteUrl, repoUrl: data.repoUrl })
    } catch (err: any) {
      setStatus('error')
      setResult({ error: err.message || 'Network error' })
    }
  }

  if (status === 'success' && result) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-emerald-500">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-serif text-foreground mb-2">Deployed Successfully</h2>
          <p className="text-sm text-muted-foreground">Your site is being built and will be live shortly.</p>
        </div>
        <div className="space-y-3 text-sm">
          {result.siteUrl && (
            <a href={result.siteUrl} target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5 border border-border rounded-lg hover:bg-muted/10 transition-colors">
              {result.siteUrl}
            </a>
          )}
          {result.repoUrl && (
            <a href={result.repoUrl} target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5 border border-border rounded-lg hover:bg-muted/10 transition-colors text-muted-foreground">
              GitHub Repository
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl font-serif text-foreground mb-2">Deploy Your Site</h2>
        <p className="text-sm text-muted-foreground">
          Choose a unique slug for your site. This will be used in the URL.
        </p>
      </div>

      <div className="space-y-4">
        {/* Project name (read-only, from Step 1) */}
        {projectName && (
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
              Project Name
            </label>
            <p className="px-3 py-2 bg-muted/10 border border-border rounded-lg text-sm text-foreground">
              {projectName}
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
            Site Slug
          </label>
          <input
            type="text"
            value={siteSlug}
            onChange={(e) => setSiteSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="luxury-heights-mumbai"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
          {siteSlug && (
            <p className="mt-1 text-xs text-muted-foreground">
              URL: https://site-{siteSlug}.pages.dev
            </p>
          )}
        </div>
      </div>

      {status === 'error' && result?.error && (
        <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{result.error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => setStep(3)}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to Editor
        </button>
        <button
          onClick={handleDeploy}
          disabled={!isValid || status === 'deploying' || status === 'uploading'}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {status === 'uploading' ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              Uploading images...
            </>
          ) : status === 'deploying' ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              Deploying...
            </>
          ) : (
            'Deploy Now'
          )}
        </button>
      </div>
    </div>
  )
}

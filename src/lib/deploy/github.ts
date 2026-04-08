import { env } from '@/lib/env'

const GITHUB_API = 'https://api.github.com'

function githubHeaders() {
  return {
    Authorization: `token ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }
}

/** Create a new repo from a GitHub template repo. */
export async function createRepoFromTemplate(
  templateRepo: string,
  newRepoName: string,
  description: string
): Promise<{ repoUrl: string; fullName: string }> {
  const endpoint = `${GITHUB_API}/repos/${env.GITHUB_ORG}/${templateRepo}/generate`
  console.log(`[GitHub] createRepoFromTemplate: org=${env.GITHUB_ORG} template=${templateRepo} newName=${newRepoName}`)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: githubHeaders(),
    body: JSON.stringify({
      owner: env.GITHUB_ORG,
      name: newRepoName,
      description,
      private: false,
      include_all_branches: false,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = (body as any)?.message ?? res.statusText
    // Log the full error body so we can diagnose 422 "Name already exists" vs other causes
    console.error(`[GitHub] createRepoFromTemplate failed (${res.status}): endpoint=${endpoint}`, JSON.stringify(body))
    throw new Error(`GitHub repo creation failed (${res.status}): ${msg}`)
  }

  const data = (await res.json()) as { html_url: string; full_name: string }
  console.log(`[GitHub] createRepoFromTemplate succeeded: fullName=${data.full_name}`)
  return { repoUrl: data.html_url, fullName: data.full_name }
}

/** Check if a repo exists without throwing. Throws on auth failures to surface bad tokens. */
export async function repoExists(repoFullName: string): Promise<boolean> {
  const res = await fetch(`${GITHUB_API}/repos/${repoFullName}`, {
    headers: githubHeaders(),
  })
  console.log(`[GitHub] repoExists(${repoFullName}): status=${res.status}`)
  if (res.status === 401 || res.status === 403) {
    throw new Error(`GitHub authentication failed (${res.status}): check GITHUB_TOKEN`)
  }
  return res.status === 200
}

/** Poll until the repo is ready (template generation is async, takes 5-15 s). */
export async function waitForRepoReady(
  repoFullName: string,
  maxWaitMs = 30_000
): Promise<void> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const ready = await repoExists(repoFullName)
    if (ready) return
    await new Promise((r) => setTimeout(r, 2_000))
  }
  throw new Error(`Timed out waiting for GitHub repo "${repoFullName}" to become available`)
}

/**
 * Poll until a specific file exists in the repo.
 * GitHub template generation populates files asynchronously — the repo can
 * return 200 before its contents are fully copied from the template.
 */
export async function waitForFileReady(
  repoFullName: string,
  filePath: string,
  maxWaitMs = 60_000
): Promise<void> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const res = await fetch(
      `${GITHUB_API}/repos/${repoFullName}/contents/${filePath}`,
      { headers: githubHeaders() }
    )
    if (res.status === 200) return
    await new Promise((r) => setTimeout(r, 3_000))
  }
  throw new Error(`Timed out waiting for "${filePath}" to appear in "${repoFullName}". Template generation may have stalled.`)
}

/**
 * Get a file's content + its SHA (required for updates).
 * Retries on 404 because GitHub template generation is async — the repo can
 * exist before its files are fully populated.
 */
export async function getFileContent(
  repoFullName: string,
  filePath: string,
  { maxRetries = 15, retryDelayMs = 4_000 } = {}
): Promise<{ content: string; sha: string }> {
  let attempt = 0
  while (true) {
    const res = await fetch(
      `${GITHUB_API}/repos/${repoFullName}/contents/${filePath}`,
      { headers: githubHeaders() }
    )

    if (res.ok) {
      const data = (await res.json()) as { content: string; sha: string }
      const decoded = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
      return { content: decoded, sha: data.sha }
    }

    // Retry on 404 — file not yet populated from template generation
    if (res.status === 404 && attempt < maxRetries) {
      attempt++
      await new Promise((r) => setTimeout(r, retryDelayMs))
      continue
    }

    throw new Error(`GitHub GET contents failed (${res.status}): ${res.statusText}`)
  }
}

/**
 * Update (PUT) a file in a repo.
 * This push triggers a Cloudflare Pages build if the project is connected.
 * Retries on 409 (SHA mismatch) by re-fetching the current SHA — this can
 * happen when GitHub template generation is still writing the file concurrently.
 */
export async function updateFileContent(
  repoFullName: string,
  filePath: string,
  content: string,
  sha: string,
  commitMessage: string,
  maxRetries = 3
): Promise<void> {
  let currentSha = sha

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(
      `${GITHUB_API}/repos/${repoFullName}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: githubHeaders(),
        body: JSON.stringify({
          message: commitMessage,
          content: Buffer.from(content, 'utf-8').toString('base64'),
          sha: currentSha,
        }),
      }
    )

    if (res.ok) return

    // 409 = SHA mismatch — re-fetch current SHA and retry
    if (res.status === 409 && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 2_000))
      const { sha: freshSha } = await getFileContent(repoFullName, filePath)
      currentSha = freshSha
      continue
    }

    const body = await res.json().catch(() => ({}))
    const msg = (body as any)?.message ?? res.statusText
    throw new Error(`GitHub PUT contents failed (${res.status}): ${msg}`)
  }
}

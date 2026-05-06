import { isRecord } from '@/lib/api/contracts'
import type { DeployEvent, DeployStepId } from '@/types'

const DEPLOY_STEP_IDS: readonly DeployStepId[] = [
  'upload_images',
  'create_repo',
  'inject_manifest',
  'cloudflare_setup',
  'save_record',
  'cf_build',
]

const DEPLOY_STEP_ID_SET = new Set<string>(DEPLOY_STEP_IDS)
const DEPLOY_EVENT_STATUS_SET = new Set<string>(['running', 'done', 'error'])

export type DeploymentStreamStatus = 'completed' | 'fallback' | 'aborted'

export interface DeploymentStreamResult {
  status: DeploymentStreamStatus
}

export interface DeploymentStreamHandlers {
  onEvent: (event: DeployEvent) => void
}

export interface DeploymentStreamOptions {
  signal?: AbortSignal
}

function isDeployEvent(value: unknown): value is DeployEvent {
  return (
    isRecord(value) &&
    typeof value.step === 'string' &&
    DEPLOY_STEP_ID_SET.has(value.step) &&
    typeof value.status === 'string' &&
    DEPLOY_EVENT_STATUS_SET.has(value.status) &&
    typeof value.message === 'string'
  )
}

function parseStreamChunk(chunk: string): DeployEvent | null {
  const line = chunk.replace(/^data:\s*/, '').trim()
  if (!line) return null

  try {
    const payload: unknown = JSON.parse(line)
    return isDeployEvent(payload) ? payload : null
  } catch {
    return null
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export async function connectDeploymentStream(
  deploymentId: string,
  handlers: DeploymentStreamHandlers,
  options: DeploymentStreamOptions = {}
): Promise<DeploymentStreamResult> {
  try {
    const response = await fetch(`/api/deploy/${deploymentId}/stream`, {
      signal: options.signal,
    })

    if (!response.ok || !response.body) {
      return { status: 'fallback' }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const cancelReader = () => {
      void reader.cancel().catch(() => {})
    }

    options.signal?.addEventListener('abort', cancelReader)

    try {
      while (!options.signal?.aborted) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''

        for (const chunk of chunks) {
          const event = parseStreamChunk(chunk)
          if (event) {
            handlers.onEvent(event)
          }
        }
      }
    } finally {
      options.signal?.removeEventListener('abort', cancelReader)
      try {
        reader.releaseLock()
      } catch {
        // The reader may already be released after cancellation.
      }
    }

    return { status: options.signal?.aborted ? 'aborted' : 'completed' }
  } catch (error) {
    if (isAbortError(error) || options.signal?.aborted) {
      return { status: 'aborted' }
    }
    return { status: 'fallback' }
  }
}

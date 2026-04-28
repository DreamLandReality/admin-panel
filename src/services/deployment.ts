import type { Deployment } from '@/types'
import type {
  ActiveDeploymentGateResult,
  ActiveDeployment,
  DeploymentService,
  DeploymentWithTemplate,
  Result,
  RestoreDeploymentResult,
  UpdateDeploymentResult,
} from './types'
import { errorResult, getResponseError, isRecord, readJson, toServiceError } from './http'

function isActiveDeployment(value: unknown): value is ActiveDeployment {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.project_name === 'string' &&
    typeof value.status === 'string' &&
    typeof value.updated_at === 'string' &&
    (typeof value.github_repo === 'string' || value.github_repo === null)
  )
}

function isDeployment(value: unknown): value is Deployment {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.project_name === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.template_id === 'string' &&
    typeof value.status === 'string'
  )
}

function isDeploymentWithTemplate(value: unknown): value is DeploymentWithTemplate {
  return (
    isRecord(value) &&
    isDeployment(value.deployment) &&
    (value.template === null || isRecord(value.template))
  )
}

function isUpdateDeploymentResult(value: unknown): value is UpdateDeploymentResult {
  return isRecord(value) && typeof value.id === 'string'
}

async function getActive(options?: { signal?: AbortSignal }): Promise<Result<ActiveDeploymentGateResult>> {
  try {
    const response = await fetch('/api/deployments/active', { signal: options?.signal })
    const payload = await readJson(response)
    if (!response.ok) {
      return { ok: false, error: getResponseError(response, payload, 'Failed to load active deployments.') }
    }
    if (!isRecord(payload)) {
      return errorResult<ActiveDeploymentGateResult>('Active deployments response was invalid.')
    }

    if (payload.deployment === null) {
      return { ok: true, data: { deployment: null, isLikelyStuck: false } }
    }
    if (!isActiveDeployment(payload.deployment)) {
      return errorResult<ActiveDeploymentGateResult>('Active deployments response was invalid.')
    }

    return {
      ok: true,
      data: {
        deployment: payload.deployment,
        isLikelyStuck: typeof payload.isLikelyStuck === 'boolean' ? payload.isLikelyStuck : false,
      },
    }
  } catch (error) {
    return { ok: false, error: toServiceError(error, 'Failed to load active deployments.') }
  }
}

export const deploymentService: DeploymentService = {
  getActive,

  async listActive(options) {
    const result = await getActive(options)
    if (!result.ok) return result
    return { ok: true, data: result.data.deployment ? [result.data.deployment] : [] }
  },

  async get(id, options) {
    try {
      const response = await fetch(`/api/deployments/${id}`, { signal: options?.signal })
      const payload = await readJson(response)
      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Failed to load deployment.') }
      }
      if (!isRecord(payload) || !isDeploymentWithTemplate(payload.data)) {
        return errorResult('Deployment response was invalid.')
      }

      return { ok: true, data: payload.data }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Failed to load deployment.') }
    }
  },

  async update(id, input, options) {
    try {
      const response = await fetch(`/api/deployments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        signal: options?.signal,
        body: JSON.stringify({ site_data: input.siteData, action: input.action }),
      })
      const payload = await readJson(response)
      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Failed to save changes.') }
      }
      if (!isRecord(payload) || !isUpdateDeploymentResult(payload.data)) {
        return errorResult('Deployment update response was invalid.')
      }

      return { ok: true, data: payload.data }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Failed to save changes.') }
    }
  },

  async delete(id, options) {
    try {
      const response = await fetch(`/api/deployments/${id}`, {
        method: 'DELETE',
        signal: options?.signal,
      })
      const payload = await readJson(response)
      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Failed to delete site.') }
      }
      if (!isRecord(payload) || payload.status !== 'archived') {
        return errorResult('Deployment delete response was invalid.')
      }

      return { ok: true, data: { status: 'archived' } }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Failed to delete site.') }
    }
  },

  async restore(id, options) {
    try {
      const response = await fetch(`/api/deployments/${id}/restore`, {
        method: 'POST',
        signal: options?.signal,
      })
      const payload = await readJson(response)
      if (!response.ok) {
        return { ok: false, error: getResponseError(response, payload, 'Failed to restore site.') }
      }
      if (!isRecord(payload) || typeof payload.deploymentId !== 'string') {
        return errorResult('Deployment restore response was invalid.')
      }

      const data: RestoreDeploymentResult = { deploymentId: payload.deploymentId }
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error: toServiceError(error, 'Failed to restore site.') }
    }
  },
}

import type { Deployment } from '@/types'
import {
  isArchivedStatusPayload,
  isDeploymentIdPayload,
  isRecord,
  isStringIdPayload,
} from '@/lib/api/contracts'
import type {
  ActiveDeploymentGateResult,
  ActiveDeployment,
  DeploymentService,
  DeploymentWithTemplate,
  Result,
  RestoreDeploymentResult,
} from './types'
import { apiJsonRequest } from './api-client'
import { errorResult } from './http'

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

async function getActive(options?: { signal?: AbortSignal }): Promise<Result<ActiveDeploymentGateResult>> {
  const result = await apiJsonRequest('/api/deployments/active', {
    signal: options?.signal,
    fallback: 'Failed to load active deployments.',
  })
  if (!result.ok) return result

  const payload = result.data
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
}

export const deploymentService: DeploymentService = {
  getActive,

  async listActive(options) {
    const result = await getActive(options)
    if (!result.ok) return result
    return { ok: true, data: result.data.deployment ? [result.data.deployment] : [] }
  },

  async get(id, options) {
    const result = await apiJsonRequest(`/api/deployments/${id}`, {
      signal: options?.signal,
      fallback: 'Failed to load deployment.',
    })
    if (!result.ok) return result

    const payload = result.data
    if (!isRecord(payload) || !isDeploymentWithTemplate(payload.data)) {
      return errorResult('Deployment response was invalid.')
    }

    return { ok: true, data: payload.data }
  },

  async update(id, input, options) {
    const result = await apiJsonRequest(`/api/deployments/${id}`, {
      method: 'PATCH',
      signal: options?.signal,
      fallback: 'Failed to save changes.',
      json: { site_data: input.siteData, action: input.action },
    })
    if (!result.ok) return result

    const payload = result.data
    if (!isRecord(payload) || !isStringIdPayload(payload.data)) {
      return errorResult('Deployment update response was invalid.')
    }

    return { ok: true, data: payload.data }
  },

  async delete(id, options) {
    const result = await apiJsonRequest(`/api/deployments/${id}`, {
      method: 'DELETE',
      signal: options?.signal,
      fallback: 'Failed to delete site.',
    })
    if (!result.ok) return result

    const payload = result.data
    if (!isArchivedStatusPayload(payload)) {
      return errorResult('Deployment delete response was invalid.')
    }

    return { ok: true, data: { status: 'archived' } }
  },

  async restore(id, options) {
    const result = await apiJsonRequest(`/api/deployments/${id}/restore`, {
      method: 'POST',
      signal: options?.signal,
      fallback: 'Failed to restore site.',
    })
    if (!result.ok) return result

    const payload = result.data
    if (!isDeploymentIdPayload(payload)) {
      return errorResult('Deployment restore response was invalid.')
    }

    const data: RestoreDeploymentResult = { deploymentId: payload.deploymentId }
    return { ok: true, data }
  },
}

import { isDeploymentIdPayload } from '@/lib/api/contracts'
import { apiJsonRequest } from './api-client'
import { errorResult } from './http'
import type { Result, ServiceRequestOptions, StartDeployInput, StartDeployResult } from './types'

export async function startDeployment(
  input: StartDeployInput,
  options?: ServiceRequestOptions
): Promise<Result<StartDeployResult>> {
  const result = await apiJsonRequest('/api/deploy', {
    method: 'POST',
    signal: options?.signal,
    fallback: 'Deployment failed. Please try again.',
    json: {
      projectName: input.projectName,
      templateId: input.templateId,
      siteData: input.siteData,
      ...(input.deploymentId ? { deploymentId: input.deploymentId } : {}),
    },
  })
  if (!result.ok) return result

  const payload = result.data
  if (!isDeploymentIdPayload(payload)) {
    return errorResult('Deployment response was invalid.')
  }

  return { ok: true, data: { deploymentId: payload.deploymentId } }
}

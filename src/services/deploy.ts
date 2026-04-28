import { errorResult, getResponseError, isRecord, readJson, toServiceError } from './http'
import type { Result, ServiceRequestOptions, StartDeployInput, StartDeployResult } from './types'

export async function startDeployment(
  input: StartDeployInput,
  options?: ServiceRequestOptions
): Promise<Result<StartDeployResult>> {
  try {
    const response = await fetch('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: options?.signal,
      body: JSON.stringify({
        projectName: input.projectName,
        templateId: input.templateId,
        siteData: input.siteData,
        ...(input.deploymentId ? { deploymentId: input.deploymentId } : {}),
      }),
    })
    const payload = await readJson(response)
    if (!response.ok) {
      return { ok: false, error: getResponseError(response, payload, 'Deployment failed. Please try again.') }
    }
    if (!isRecord(payload) || typeof payload.deploymentId !== 'string') {
      return errorResult('Deployment response was invalid.')
    }

    return { ok: true, data: { deploymentId: payload.deploymentId } }
  } catch (error) {
    return { ok: false, error: toServiceError(error, 'Deployment failed. Please try again.') }
  }
}

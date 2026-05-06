import { DEPLOY_STEP_LABELS } from '@/types'
import type { DeployStepId, DeployStepState } from '@/types'

export const DEPLOY_STEP_SHORT_LABELS: Record<DeployStepId, string> = {
  upload_images: 'Images',
  create_repo: 'Repo',
  inject_manifest: 'Data',
  cloudflare_setup: 'Hosting',
  save_record: 'Save',
  cf_build: 'Build',
}

export const FIRST_DEPLOY_STEPS: DeployStepId[] = [
  'upload_images',
  'create_repo',
  'inject_manifest',
  'cloudflare_setup',
  'save_record',
  'cf_build',
]

export const REDEPLOY_STEPS: DeployStepId[] = [
  'upload_images',
  'inject_manifest',
  'save_record',
  'cf_build',
]

export function makeDeploySteps(isRedeploy: boolean): DeployStepState[] {
  return (isRedeploy ? REDEPLOY_STEPS : FIRST_DEPLOY_STEPS).map((id) => ({
    id,
    label: DEPLOY_STEP_LABELS[id],
    status: 'pending',
  }))
}

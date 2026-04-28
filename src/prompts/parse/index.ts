import type { ManifestSection } from '@/types'
import { buildParseSystemPrompt } from './system'
import { buildParseUserPrompt } from './user'

export function buildParsePrompt(sections: ManifestSection[], rawText: string) {
  return {
    systemPrompt: buildParseSystemPrompt(sections),
    userPrompt: buildParseUserPrompt(rawText),
  }
}

export { buildParseSystemPrompt } from './system'
export { buildParseUserPrompt } from './user'

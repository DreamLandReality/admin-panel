import type { Result } from '@/services/types'

export async function unwrapResult<T>(resultPromise: Promise<Result<T>>): Promise<T> {
  const result = await resultPromise
  if (!result.ok) {
    throw new Error(result.error.message)
  }
  return result.data
}

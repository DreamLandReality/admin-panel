/**
 * Wrapper around fetch() that aborts the request after a configurable timeout.
 * Use this instead of bare fetch() for all server-to-server calls to prevent
 * the pipeline from hanging indefinitely when a downstream service is unresponsive.
 *
 * @param url     The URL to fetch
 * @param options Standard RequestInit options (signal will be overridden)
 * @param timeoutMs Milliseconds before the request is aborted (default: 30s)
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

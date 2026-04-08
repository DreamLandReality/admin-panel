import { useRef, useCallback, useEffect } from 'react'

export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const callbackRef = useRef(callback)

  // Sync the latest callback into the ref on every render. This is intentionally
  // independent of `delay` — updating callbackRef does not recreate the debounced
  // wrapper, so callers never trigger new timers just because the callback identity changed.
  useEffect(() => { callbackRef.current = callback }, [callback])
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  return useCallback((...args: any[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay)
  }, [delay]) as T
}

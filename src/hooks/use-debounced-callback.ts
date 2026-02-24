import { useRef, useCallback, useEffect } from 'react'

export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const callbackRef = useRef(callback)

  useEffect(() => { callbackRef.current = callback }, [callback])
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  return useCallback((...args: any[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay)
  }, [delay]) as T
}

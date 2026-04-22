import { ThemedToaster } from '@/components/themed-toaster'

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ThemedToaster />
    </>
  )
}

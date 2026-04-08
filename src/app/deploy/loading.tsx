export default function Loading() {
  return (
    <div className="dark fixed inset-0 bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
        <span className="text-sm text-white/40">Preparing deployment...</span>
      </div>
    </div>
  )
}

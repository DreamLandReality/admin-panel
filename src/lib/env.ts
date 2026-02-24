function requireValue(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  get SUPABASE_URL() {
    return requireValue('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
  },
  get SUPABASE_ANON_KEY() {
    return requireValue('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)
  },
}

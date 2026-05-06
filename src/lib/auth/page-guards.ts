import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getUserRole, hasCapability, type Capability, type UserRole } from '@/lib/auth/roles'

type SupabaseServerClient = ReturnType<typeof createClient>

export type PageAuth = {
  supabase: SupabaseServerClient
  user: User
  role: UserRole
}

export async function requirePageCapability(capability: Capability): Promise<PageAuth> {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const role = getUserRole(user)
  if (!role || !hasCapability(role, capability)) {
    redirect('/login?error=unauthorized')
  }

  return { supabase, user, role }
}

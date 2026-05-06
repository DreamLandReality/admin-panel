import type { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { forbidden, unauthorized } from '@/lib/api/response'
import { getUserRole, hasCapability, type Capability, type UserRole } from '@/lib/auth/roles'

type SupabaseServerClient = ReturnType<typeof createClient>

export type ApiAuthSuccess = {
  ok: true
  supabase: SupabaseServerClient
  user: User
  role: UserRole
}

export type ApiAuthFailure = {
  ok: false
  response: NextResponse
}

export type ApiAuthResult = ApiAuthSuccess | ApiAuthFailure

function authForbidden(message = 'Forbidden'): ApiAuthFailure {
  return {
    ok: false,
    response: forbidden(message),
  }
}

export async function requireUser(): Promise<ApiAuthResult> {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false,
      response: unauthorized(),
    }
  }

  const role = getUserRole(user)
  if (!role) {
    return authForbidden('Unknown role')
  }

  return { ok: true, supabase, user, role }
}

export async function requireRole(allowedRoles: UserRole | UserRole[]): Promise<ApiAuthResult> {
  const auth = await requireUser()
  if (!auth.ok) return auth

  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  return allowed.includes(auth.role) ? auth : authForbidden()
}

export async function requireCapability(capability: Capability): Promise<ApiAuthResult> {
  const auth = await requireUser()
  if (!auth.ok) return auth

  return hasCapability(auth.role, capability) ? auth : authForbidden()
}

export function forbidSalesMutation(role: UserRole): NextResponse | null {
  return role === 'sales'
    ? forbidden('Sales users cannot perform this mutation')
    : null
}

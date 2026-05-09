import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

type StaffRole = "admin" | "sales"

const ADMIN_SECRET_HEADER = "x-admin-creation-secret"
const JSON_HEADERS = { "Content-Type": "application/json" }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function getSupabaseSecretKey() {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS") ?? ""

  try {
    const parsed: unknown = JSON.parse(keys)
    if (isRecord(parsed)) {
      const defaultKey = getString(parsed.default)
      if (defaultKey) return defaultKey
    }
  } catch {
    // Secret keys are JSON in hosted Supabase; keep this empty for a clean error below.
  }

  throw new Error("Missing SUPABASE_SECRET_KEYS.default")
}

function isStaffRole(value: unknown): value is StaffRole {
  return value === "admin" || value === "sales"
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error"
}

console.log("create-users function started")

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST from the Supabase Dashboard function test panel." }), {
        headers: JSON_HEADERS,
        status: 405,
      })
    }

    const adminCreationSecret = Deno.env.get("ADMIN_CREATION_SECRET")
    const headerSecret = req.headers.get(ADMIN_SECRET_HEADER) ?? ""

    if (!adminCreationSecret || headerSecret !== adminCreationSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: JSON_HEADERS,
        status: 401,
      })
    }

    const payload: unknown = await req.json()

    if (!isRecord(payload)) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        headers: JSON_HEADERS,
        status: 400,
      })
    }

    const email = getString(payload.email)
    const password = getString(payload.password)
    const displayName = getString(payload.display_name)
    const phoneNumber = getString(payload.phone_number)
    const role = payload.role

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        headers: JSON_HEADERS,
        status: 400,
      })
    }

    if (!isStaffRole(role)) {
      return new Response(JSON.stringify({ error: "Role must be admin or sales" }), {
        headers: JSON_HEADERS,
        status: 400,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      getSupabaseSecretKey(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      phone: phoneNumber || undefined,
      email_confirm: true,
      // Authorization reads app_metadata because user_metadata is editable by users.
      app_metadata: { user_role: role },
      user_metadata: {
        full_name: displayName || "",
        phone_number: phoneNumber || "",
      },
    })

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        message: `Successfully created ${role} user: ${email}`,
        user,
      }),
      {
        headers: JSON_HEADERS,
        status: 200,
      }
    )
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: getErrorMessage(err) }), {
      headers: JSON_HEADERS,
      status: 500,
    })
  }
})

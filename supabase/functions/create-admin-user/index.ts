import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

type StaffRole = "admin" | "sales"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isStaffRole(value: unknown): value is StaffRole {
  return value === "admin" || value === "sales"
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error"
}

console.log("Create staff user function started")

serve(async (req) => {
  try {
    const secret = Deno.env.get("ADMIN_CREATION_SECRET")
    const authHeader = req.headers.get("Authorization") ?? ""
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { "Content-Type": "application/json" },
        status: 401,
      })
    }

    const payload: unknown = await req.json()

    if (!isRecord(payload)) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
        status: 400,
      })
    }

    if (!isStaffRole(role)) {
      return new Response(JSON.stringify({ error: "Role must be admin or sales" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: getErrorMessage(err) }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})

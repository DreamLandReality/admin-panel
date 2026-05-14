import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

console.log("Create Sales User function started")

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

    const { email, password, display_name, phone_number, company_name } = await req.json()

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
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
      phone: phone_number || undefined,
      email_confirm: true,
      app_metadata: { user_role: "sales" },
      user_metadata: {
        full_name: display_name || "",
        phone_number: phone_number || "",
        company_name: company_name || "Dream Land Reality",
      },
    })

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        message: `Successfully created sales user: ${email}`,
        company_name: company_name || "Dream Land Reality",
        user,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})

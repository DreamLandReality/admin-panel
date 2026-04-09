// @ts-nocheck — Deno edge function, not a Node/TypeScript project file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// ── Property context builder ──────────────────────────────────────────────────
// Mirrors src/lib/voice/extract-property-context.ts — pure data transformation,
// no external deps. Update both files if the logic ever changes.

const SKIP_SECTIONS = new Set(["seo", "navigation", "footer"])
const SKIP_KEYS = new Set(["submissionEndpoint", "siteToken", "supabaseAnonKey"])

function stripStyleKeys(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(stripStyleKeys)
  if (data !== null && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>)
        .filter(([k]) => !k.endsWith("__style") && !k.endsWith("__styles"))
        .map(([k, v]) => [k, stripStyleKeys(v)])
    )
  }
  return data
}

function flattenToLines(data: unknown, skipKeys: Set<string>, prefix = ""): string[] {
  if (data === null || data === undefined) return []
  if (typeof data === "string") return data.trim() && prefix ? [`${prefix}: ${data.trim()}`] : []
  if (typeof data === "number" || typeof data === "boolean") return prefix ? [`${prefix}: ${data}`] : []
  if (Array.isArray(data)) {
    if (data.every((i) => typeof i === "string")) return prefix && data.length ? [`${prefix}: ${data.join(", ")}`] : []
    return data.flatMap((item, i) => flattenToLines(item, skipKeys, prefix ? `${prefix}[${i}]` : String(i)))
  }
  if (typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .filter(([k]) => !skipKeys.has(k) && !k.startsWith("_"))
      .flatMap(([k, v]) => flattenToLines(v, skipKeys, prefix ? `${prefix}.${k}` : k))
  }
  return []
}

function extractPropertyContext(manifest: unknown, siteData: unknown): string {
  const m = manifest as any
  const s = siteData as any
  const lines: string[] = []
  for (const section of m?.sections ?? []) {
    if (SKIP_SECTIONS.has(section.id)) continue
    if (section.enabled === false) continue
    const schemaProps = section.schema?.properties ?? {}
    if (schemaProps.submissionEndpoint || schemaProps.siteToken) continue
    const raw = s?.[section.id] ?? section.data
    if (!raw) continue
    lines.push(...flattenToLines(stripStyleKeys(raw), SKIP_KEYS))
  }
  for (const col of m?.collections ?? []) {
    const items = s?._collections?.[col.id] ?? col.data
    if (!items?.length) continue
    lines.push(`\n${col.label ?? col.id}:`)
    for (const item of items.slice(0, 5)) {
      const flat = flattenToLines(item, SKIP_KEYS)
      if (flat.length) lines.push("  - " + flat.join(", "))
    }
  }
  return lines.join("\n").trim()
}

// ─────────────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS, status: 204 })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 405,
    })
  }

  try {
    const body = await req.json()
    const {
      siteToken,
      name: rawName,
      firstName,
      lastName,
      email,
      phone,
      message,
      source_url,
      form_type,
    } = body

    // Combine firstName + lastName if name not provided (ContactForm sends split names)
    const name = (rawName || `${firstName || ""} ${lastName || ""}`.trim()).trim()

    // Validate required fields
    if (!siteToken || !name || !email?.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: siteToken, name, email" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Extract client IP for rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown"

    // Look up deployment by siteToken — also fetch manifest for property context
    const { data: deployment, error: dError } = await supabase
      .from("deployments")
      .select("id, slug, project_name, template_manifest, site_data")
      .eq("site_token", siteToken)
      .single()

    if (dError || !deployment) {
      return new Response(
        JSON.stringify({ error: "Site not found" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, status: 404 }
      )
    }

    // Rate limit: max 5 submissions per IP per deployment per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentCount } = await supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .eq("deployment_id", deployment.id)
      .gte("created_at", oneHourAgo)

    if ((recentCount ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many submissions. Please try again later." }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, status: 429 }
      )
    }

    // Insert the form submission
    const { data: insertedRow, error: insertError } = await supabase
      .from("form_submissions")
      .insert({
        deployment_id: deployment.id,
        deployment_slug: deployment.slug,
        name: name,
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        message: message?.trim() || null,
        source_url: source_url?.trim() || "",
        ip_address: ip,
        form_type: form_type || "contact",
      })
      .select("id")
      .single()

    if (insertError || !insertedRow) {
      console.error("[submit-form] Insert error:", insertError)
      return new Response(
        JSON.stringify({ error: "Failed to save submission" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, status: 500 }
      )
    }

    // ── Build property context server-side ───────────────────────────────────
    const propertyContext = deployment.template_manifest && deployment.site_data
      ? extractPropertyContext(deployment.template_manifest, deployment.site_data) || null
      : null

    // ── Schedule or initiate voice call ──────────────────────────────────────
    const voiceEnabled = Deno.env.get("VOICE_AGENT_ENABLED") === "true"
    const devMode = Deno.env.get("VOICE_AGENT_DEV_MODE") === "true"
    const elevenlabsKey = Deno.env.get("ELEVENLABS_API_KEY")
    const agentId = Deno.env.get("ELEVENLABS_AGENT_ID")
    const qstashToken = Deno.env.get("QSTASH_TOKEN")
    const adminUrl = Deno.env.get("ADMIN_PANEL_URL")

    if (voiceEnabled && phone?.trim()) {
      if (devMode && elevenlabsKey && agentId) {
        // ── DEV MODE: get signed URL so browser can connect immediately ──────
        try {
          const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`, {
            method: "GET",
            headers: { "xi-api-key": elevenlabsKey },
          })

          if (!res.ok) {
            const errText = await res.text()
            console.error("[submit-form] ElevenLabs error:", res.status, errText)
          }

          if (res.ok) {
            const json = await res.json()
            const signed_url = json.signed_url ?? json.signedUrl ?? json.url
            await supabase
              .from("form_submissions")
              .update({
                call_status: "calling",
                call_signed_url: signed_url,
                call_property_context: propertyContext,
                call_scheduled_at: new Date().toISOString(),
                call_attempts: 1,
              })
              .eq("id", insertedRow.id)
          }
        } catch (err) {
          console.error("[submit-form] Dev voice call failed:", err)
        }

      } else if (!devMode && qstashToken && adminUrl) {
        // ── PROD MODE: schedule via QStash ────────────────────────────────────
        try {
          const delaySeconds = (Math.floor(Math.random() * 31) + 30) * 60 // 30-60 min
          const triggerUrl = `${adminUrl}/api/voice-call/trigger`

          await fetch(`https://qstash.upstash.io/v1/publish/${triggerUrl}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${qstashToken}`,
              "Content-Type": "application/json",
              "Upstash-Delay": `${delaySeconds}s`,
              "Upstash-Retries": "2",
            },
            body: JSON.stringify({
              submission_id: insertedRow.id,
              phone: phone.trim(),
              name,
              deployment_slug: deployment.slug,
              property_name: deployment.project_name,
            }),
          })

          await supabase
            .from("form_submissions")
            .update({
              call_status: "scheduled",
              call_property_context: propertyContext,
              call_scheduled_at: new Date().toISOString(),
              call_scheduled_for: new Date(Date.now() + delaySeconds * 1000).toISOString(),
            })
            .eq("id", insertedRow.id)
        } catch (err) {
          console.error("[submit-form] Failed to schedule voice call:", err)
        }
      }
    } else if (!phone?.trim()) {
      await supabase
        .from("form_submissions")
        .update({ call_status: "skipped" })
        .eq("id", insertedRow.id)
    }

    return new Response(
      JSON.stringify({ success: true, message: "Thank you for your enquiry!" }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (err: any) {
    console.error("[submit-form] Unexpected error:", err)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, status: 500 }
    )
  }
})

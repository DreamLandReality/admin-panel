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

function labelFromRawSource(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Unknown"
}

function resolveLeadSource(manifest: unknown, rawFormType: unknown): Record<string, unknown> {
  const id = typeof rawFormType === "string" && rawFormType.trim()
    ? rawFormType.trim()
    : "contact"
  const leadSources = (manifest as any)?.leadSources
  const source = leadSources && typeof leadSources === "object" ? leadSources[id] : null

  if (source && typeof source === "object") {
    return {
      id,
      label: typeof source.label === "string" && source.label.trim() ? source.label : labelFromRawSource(id),
      kind: typeof source.kind === "string" && source.kind.trim() ? source.kind : "custom",
      sectionId: typeof source.sectionId === "string" ? source.sectionId : undefined,
      gateId: typeof source.gateId === "string" ? source.gateId : undefined,
      known: true,
    }
  }

  return {
    id,
    label: `Unknown: ${labelFromRawSource(id)}`,
    kind: "unknown",
    known: false,
  }
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

    console.log("[submit-form] Received:", { siteToken: !!siteToken, name, email: email?.trim(), phone: phone?.trim() || null })

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

    console.log("[submit-form] Deployment lookup:", { found: !!deployment, error: dError?.message })

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

    console.log("[submit-form] Rate limit check:", { ip, recentCount, deployment_id: deployment.id })
    if ((recentCount ?? 0) >= 5) {
      console.log("[submit-form] Rate limited")
      return new Response(
        JSON.stringify({ error: "Too many submissions. Please try again later." }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, status: 429 }
      )
    }

    // Deduplication: check if this email already submitted for this deployment
    const { data: existingSubmission } = await supabase
      .from("form_submissions")
      .select("id, created_at")
      .eq("deployment_id", deployment.id)
      .eq("email", email.trim().toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSubmission) {
      console.log("[submit-form] Duplicate submission detected:", { 
        deployment_id: deployment.id, 
        email: email.trim().toLowerCase(),
        existing_id: existingSubmission.id,
        existing_created_at: existingSubmission.created_at
      })
      return new Response(
        JSON.stringify({ 
          success: true, 
          alreadySubmitted: true,
          message: "Thank you for your enquiry!" 
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, status: 200 }
      )
    }

    const normalizedFormType = typeof form_type === "string" && form_type.trim()
      ? form_type.trim()
      : "contact"
    const sourceMetadata = resolveLeadSource(deployment.template_manifest, normalizedFormType)

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
        form_type: normalizedFormType,
        source_metadata: sourceMetadata,
      })
      .select("id")
      .single()

    console.log("[submit-form] Insert result:", { id: insertedRow?.id, error: insertError?.message })

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
    const qstashToken = Deno.env.get("QSTASH_TOKEN")
    const adminUrl = Deno.env.get("ADMIN_PANEL_URL")

    console.log("[submit-form] Voice config:", { voiceEnabled, devMode, hasQstashToken: !!qstashToken, hasAdminUrl: !!adminUrl, hasPhone: !!phone?.trim() })

    if (voiceEnabled && (devMode || phone?.trim())) {
      console.log("[submit-form] Voice block entered")
      if (qstashToken && adminUrl) {
        // ── Schedule via QStash. Dev mode has no delay; prod keeps 30-60 min. ──
        try {
          const delaySeconds = devMode ? 0 : (Math.floor(Math.random() * 31) + 30) * 60 // prod: 30-60 min
          const triggerUrl = `${adminUrl}/api/voice-call/trigger`
          const headers: Record<string, string> = {
            Authorization: `Bearer ${qstashToken}`,
            "Content-Type": "application/json",
            "Upstash-Retries": "2",
          }
          if (delaySeconds > 0) {
            headers["Upstash-Delay"] = `${delaySeconds}s`
          }

          const qstashResponse = await fetch(`https://qstash.upstash.io/v1/publish/${triggerUrl}`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              submission_id: insertedRow.id,
              phone: phone?.trim() || "",
              name,
              deployment_slug: deployment.slug,
              property_name: deployment.project_name,
            }),
          })

          if (!qstashResponse.ok) {
            const errorText = await qstashResponse.text().catch(() => "")
            throw new Error(`QStash publish failed (${qstashResponse.status}): ${errorText}`)
          }

          await supabase
            .from("form_submissions")
            .update({
              call_status: "scheduled",
              call_scheduled_at: new Date().toISOString(),
              call_scheduled_for: new Date(Date.now() + delaySeconds * 1000).toISOString(),
              call_property_context: propertyContext,
            })
            .eq("id", insertedRow.id)
        } catch (err) {
          console.error("[submit-form] Failed to schedule voice call:", err)
          await supabase
            .from("form_submissions")
            .update({
              call_status: "failed",
              call_property_context: propertyContext,
            })
            .eq("id", insertedRow.id)
        }
      } else {
        await supabase
          .from("form_submissions")
          .update({
            call_status: "failed",
            call_property_context: propertyContext,
          })
          .eq("id", insertedRow.id)
      }
    } else if (!devMode && !phone?.trim()) {
      await supabase
        .from("form_submissions")
        .update({ call_status: "skipped", call_property_context: propertyContext })
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

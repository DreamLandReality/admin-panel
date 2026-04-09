# Issue: Property context not injected server-side in dev mode

In **prod mode**, when QStash fires the trigger route, the route fetches the deployment's `template_manifest` and `site_data` from Supabase and builds the property context before calling ElevenLabs. Everything is server-side.

In **dev mode**, the `submit-form` edge function generates a signed URL from ElevenLabs with no context attached. The browser (`enquiry/page.tsx`) then fetches the deployment manifest separately via `/api/deployments/[id]` and passes the context as `overrides` to `Conversation.startSession`. The context is built and injected client-side.

The two modes are inconsistent. The property context should be built server-side in both cases.

**Files involved:**
- `supabase/functions/submit-form/index.ts` — generates the signed URL, no context
- `src/app/(dashboard)/enquiry/page.tsx` — fetches manifest and passes overrides in the browser

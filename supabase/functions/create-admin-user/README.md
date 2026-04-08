# create-admin-user

Supabase Edge Function to create a new admin user via the Supabase Auth Admin API.

## What it does

- Creates a new user with `user_role: "admin"` in `app_metadata`
- Auto-confirms the email so the user can log in immediately
- Accepts an optional `company_name` — if omitted, a random real-estate company name is generated

## Endpoint

```
POST https://<project-ref>.supabase.co/functions/v1/create-admin-user
```

## Request

| Field          | Type   | Required | Description                                        |
| -------------- | ------ | -------- | -------------------------------------------------- |
| `email`        | string | Yes      | New user's email address                           |
| `password`     | string | Yes      | New user's password                                |
| `display_name` | string | No       | Full name stored in `user_metadata.full_name`      |
| `phone_number` | string | No       | Phone stored in `user_metadata.phone_number`       |
| `company_name` | string | No       | Company name — random real-estate name if omitted  |

### Example

```json
{
  "email": "admin@dreamlandrealty.com",
  "password": "supersecret",
  "display_name": "Aswin Kumar",
  "phone_number": "+91 9876543210",
  "company_name": "Dream Land Reality"
}
```

## Response

```json
{
  "message": "Successfully created admin user: admin@dreamlandrealty.com",
  "company_name": "Dream Land Reality",
  "user": { ... }
}
```

## Environment Variables

Set these in your Supabase project secrets (they are injected automatically for edge functions):

| Variable                    | Description                        |
| --------------------------- | ---------------------------------- |
| `SUPABASE_URL`              | Your project URL                   |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin-level API) |

## Deploying

```bash
npx supabase functions deploy create-admin-user
```

Run from the `admin-panel/` directory.

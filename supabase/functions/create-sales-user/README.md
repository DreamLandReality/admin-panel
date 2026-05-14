# create-sales-user

Supabase Edge Function to create a new sales user via the Supabase Auth Admin API.

## What it does

- Creates a new user with `user_role: "sales"` in `app_metadata`
- Auto-confirms the email so the user can log in immediately
- Accepts optional `company_name` — defaults to "Dream Land Reality" if omitted
- Sales users have limited access to deployments and form submissions

## Endpoint

```
POST https://<project-ref>.supabase.co/functions/v1/create-sales-user
```

## Request

| Field          | Type   | Required | Description                                        |
| -------------- | ------ | -------- | -------------------------------------------------- |
| `email`        | string | Yes      | New user's email address                           |
| `password`     | string | Yes      | New user's password                                |
| `display_name` | string | No       | Full name stored in `user_metadata.full_name`      |
| `phone_number` | string | No       | Phone stored in `user_metadata.phone_number`       |
| `company_name` | string | No       | Company name — defaults to "Dream Land Reality"    |

### Example

```json
{
  "email": "sales@dreamlandrealty.com",
  "password": "supersecret",
  "display_name": "Sales Team",
  "phone_number": "+91 9876543210",
  "company_name": "Dream Land Reality"
}
```

## Response

```json
{
  "message": "Successfully created sales user: sales@dreamlandrealty.com",
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
| `ADMIN_CREATION_SECRET`     | Bearer token for authorization     |

## Deploying

```bash
npx supabase functions deploy create-sales-user
```

Run from the `admin-panel/` directory.

# create-admin-user

Supabase Edge Function to create a new admin or sales staff user via the Supabase Auth Admin API.

The function name is kept as `create-admin-user` for compatibility with the existing deployed endpoint and operator runbooks.

## What it does

- Creates a new user with `user_role: "admin"` or `user_role: "sales"` in `app_metadata`
- Auto-confirms the email so the user can log in immediately
- Stores optional display name and phone number in `user_metadata`

## Endpoint

```
POST https://<project-ref>.supabase.co/functions/v1/create-admin-user
```

## Request

| Field          | Type   | Required | Description                                        |
| -------------- | ------ | -------- | -------------------------------------------------- |
| `email`        | string | Yes      | New user's email address                           |
| `password`     | string | Yes      | New user's password                                |
| `role`         | string | Yes      | Staff role: `admin` or `sales`                     |
| `display_name` | string | No       | Full name stored in `user_metadata.full_name`      |
| `phone_number` | string | No       | Phone stored in `user_metadata.phone_number`       |

### Example

```json
{
  "email": "admin@dreamlandrealty.com",
  "password": "supersecret",
  "role": "admin",
  "display_name": "Aswin Kumar",
  "phone_number": "+91 9876543210"
}
```

```json
{
  "email": "sales@dreamlandrealty.com",
  "password": "supersecret",
  "role": "sales",
  "display_name": "Sales User",
  "phone_number": "+91 9876543210"
}
```

## Response

```json
{
  "message": "Successfully created admin user: admin@dreamlandrealty.com",
  "user": { ... }
}
```

## Environment Variables

Set these in your Supabase project secrets (they are injected automatically for edge functions):

| Variable                    | Description                        |
| --------------------------- | ---------------------------------- |
| `SUPABASE_URL`              | Your project URL                   |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin-level API) |
| `ADMIN_CREATION_SECRET`     | Bearer token required by this function |

## Deploying

```bash
npx supabase functions deploy create-admin-user
```

Run from the `admin-panel/` directory.

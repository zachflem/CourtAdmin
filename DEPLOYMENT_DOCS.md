# CourtAdmin — Deployment Documentation

Tracks every manual step required to stand up a fresh instance.
Steps marked **🤖 automatable** are candidates for the Phase 15 deploy script.

---

## Prerequisites

- Node.js 18+
- `npx wrangler` available (installed as a project dev dependency — no global install needed)
- A Cloudflare account with:
  - Workers & Pages enabled
  - D1 enabled
  - R2 enabled
  - Zero Trust / Cloudflare Access enabled (free tier is sufficient)
- A [Resend](https://resend.com) account with an API key

---

## Step 1 — Cloudflare Access Application

**Dashboard path:** Cloudflare Zero Trust → Access → Applications → Add an application

Manual — cannot be fully automated via Wrangler CLI.

1. Click **Add an application** → choose **Self-hosted**
2. **Application name:** CourtAdmin (or your preferred name)
3. **Application domain:** the subdomain the Worker will be deployed to
   - e.g. `court-admin.yourdomain.workers.dev` for a Workers subdomain
   - or a custom domain like `api.yourdomain.com`
4. **Identity providers:** select **One-time PIN** (email magic link / OTP — no third-party IdP needed)
5. **Policy:** create a policy:
   - Policy name: e.g. `Allow all`
   - Action: `Allow`
   - Rule: `Everyone` (any email can authenticate; roles are controlled in the app)
   - Alternatively, restrict to a specific email domain with rule `Emails ending in @yourdomain.com`
6. Save the application
7. On the application overview page, copy the **AUD tag** (Application Audience string)

---

## Step 2 — Worker Secrets

**🤖 automatable** (via `wrangler secret put` in deploy script)

```bash
# Cloudflare Access AUD tag (from Step 1)
npx wrangler secret put CF_ACCESS_AUD

# Resend API key (from resend.com → API Keys)
npx wrangler secret put RESEND_API_KEY
```

Both commands prompt for the value interactively.

---

## Step 3 — D1 Database

**🤖 automatable**

```bash
# Create the database
npx wrangler d1 create court-admin-db
```

Copy the `database_id` printed by the command and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "court-admin-db"
database_id = "<paste id here>"
```

Then apply migrations:

```bash
# Apply to remote (production) database
npx wrangler d1 migrations apply court-admin-db --remote

# Apply to local database (for local dev)
npx wrangler d1 migrations apply court-admin-db
```

**Current database ID:** `33198368-5fdc-497d-bd78-2c480c08b566` (region OC)

---

## Step 4 — R2 Bucket

**🤖 automatable**

```bash
npx wrangler r2 bucket create court-admin-assets
```

The bucket name `court-admin-assets` is already referenced in `wrangler.toml` — no further config needed.

---

## Step 5 — Deploy the Worker

**🤖 automatable**

```bash
npx wrangler deploy
```

---

## Step 6 — Build and Deploy the Frontend (Pages)

**🤖 automatable**

```bash
# Build the frontend
cd frontend && npm run build && cd ..

# Deploy to Cloudflare Pages
npx wrangler pages deploy frontend/dist --project-name court-admin
```

> **First deploy only:** if the Pages project doesn't exist yet, Wrangler will prompt you to create it. On subsequent deploys it will publish to the existing project.

---

## Step 7 — Seed the Admin User

**🤖 automatable**

Insert the first admin user directly into D1. Replace the email and name with the real values.

```bash
npx wrangler d1 execute court-admin-db --remote --command \
  "INSERT INTO users (id, email, first_name, last_name, roles, is_active, created_at, updated_at)
   VALUES (lower(hex(randomblob(16))), 'admin@yourdomain.com', 'Admin', 'User', '[\"admin\"]', 1, datetime('now'), datetime('now'))
   ON CONFLICT(email) DO UPDATE SET roles = '[\"admin\"]';"
```

---

## Step 8 — Configure `FRONTEND_URL` var

In `wrangler.toml`, update the `FRONTEND_URL` var to the actual Pages URL once it is known:

```toml
[vars]
FRONTEND_URL = "https://court-admin.pages.dev"
```

Redeploy the Worker after updating:

```bash
npx wrangler deploy
```

---

## Local Development

```bash
# Run the Worker locally (uses local D1 + R2 state in .wrangler/)
npm run dev

# Run the frontend dev server
npm run frontend:dev
```

For local dev, the Worker's CF Access auth middleware accepts an `X-Dev-Email` header
instead of the real `CF-Access-Authenticated-User-Email` header — but **only** when the
`CF_ACCESS_AUD` secret is set to the literal string `dev`.

To test locally with a specific user, pass the header in your requests:
```
X-Dev-Email: you@example.com
```

Or set it in the Vite dev proxy / a browser extension.

---

## Re-running Migrations (after adding new migration files)

```bash
# Remote
npx wrangler d1 migrations apply court-admin-db --remote

# Local
npx wrangler d1 migrations apply court-admin-db
```

Wrangler tracks which migrations have already been applied and only runs new ones.

---

## Checklist — Fresh Instance

- [ ] Step 1: CF Access application created, AUD tag copied
- [ ] Step 2: Worker secrets set (`CF_ACCESS_AUD`, `RESEND_API_KEY`)
- [ ] Step 3: D1 database created, ID in `wrangler.toml`, migrations applied
- [ ] Step 4: R2 bucket created
- [ ] Step 5: Worker deployed
- [ ] Step 6: Frontend built and deployed to Pages
- [ ] Step 7: Admin user seeded
- [ ] Step 8: `FRONTEND_URL` updated and Worker redeployed
